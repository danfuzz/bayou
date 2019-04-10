// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ConnectionError } from '@bayou/api-common';
import { BodyChange, BodyDelta, BodyOp, BodySnapshot } from '@bayou/doc-common';
import { Condition, Delay } from '@bayou/promise-util';
import { QuillEvents, QuillUtil } from '@bayou/quill-util';
import { TInt, TString } from '@bayou/typecheck';
import { StateMachine } from '@bayou/state-machine';
import { Errors, Functor, InfoError } from '@bayou/util-common';

import DocSession from './DocSession';

/**
 * {Int} Minimum amount of time to wait (and continue to retry connections)
 * before deciding that an instance is in an "unrecoverable" error state.
 */
const ERROR_STATE_MIN_TIME_MSEC = 45 * 1000; // 45 seconds.

/**
 * {Int} Amount of time in msec over which errors are counted, in order to
 * determine that an instance is in an "unrecoverable" error state.
 */
const ERROR_WINDOW_MSEC = 3 * 60 * 1000; // Three minutes.

/**
 * {number} Error rate, expressed in errors per minute, above which constitutes
 * sufficient evidence that the instance is in an "unrecoverable" error state.
 */
const ERROR_MAX_PER_MINUTE = 3.00;

/**
 * {Int} How long to wait (in msec) after receiving a local change (to allow
 * time for other changes to get coalesced) before pushing a change up to the
 * server.
 */
const PUSH_DELAY_MSEC = 1000;

/**
 * {Int} How long to wait (in msec) after receiving a server change (to allow
 * time for other changes to get coalesced) before requesting additional changes
 * from the server.
 */
const PULL_DELAY_MSEC = 1000;

/**
 * {Int} How long to wait (in msec) after detecting the first error in the error
 * window, before attempting to restart.
 */
const FIRST_RESTART_DELAY_MSEC = 1000; // One second.

/**
 * {Int} How long to wait (in msec) after detecting an error after the first,
 * before attempting to restart.
 */
const RESTART_DELAY_MSEC = 5 * 1000; // Five seconds.

/**
 * {Int} How long to wait (in msec) between attempts to `stop`, when the client
 * finds that it's in the middle of an operation.
 */
const STOP_POLL_DELAY_MSEC = 500; // Half a second.

/**
 * Tag used to identify this module as the source of a Quill event or action.
 */
const CLIENT_SOURCE = 'doc-client';

/**
 * Plumbing between Quill on the client and the document model on the server.
 * It is structured as a state machine, which maintains a current named state
 * along with a few other bits of information, and takes action upon receipt of
 * structured events, some of which it produces itself either immediately in
 * response to received events or after an explicit time delay.
 *
 * ### Design note
 *
 * We drive the process of getting changes from the server purely as a
 * client-to-server polling "pull." This keeps the model considerably simpler.
 * In particular, with this arrangement the transport-level concerns about
 * keeping a held-open connection (such as a websocket) open are more cleanly
 * separated from the higher-level application logic of synchronizing document
 * changes. It similarly helps maintain flexibility in choice of transport.
 * Finally, this makes it so the server, while not totally stateless, does not
 * have to maintain any intermediate transaction state with regard to a client
 * connection.
 *
 * Despite the polling nature, this arrangement still allows for changes from
 * the server to make their way to the client promptly, and it does so without
 * wasting time or network resources polling for changes that haven't happened.
 * This is because of how the `body_getChangeAfter()` API method is defined.
 * Specifically, that method does not return a result until at least one change
 * has been made. This means that the client can make that API call and then
 * just wait until it comes back with a result, instead of having to set up a
 * low-duration timeout to repeatedly ask for new changes.
 */
export default class BodyClient extends StateMachine {
  /**
   * Constructs an instance. It is initially in state `detached`. The
   * constructed instance expects to be the primary non-human controller of the
   * Quill instance it manages.
   *
   * @param {QuillProm} quill Quill editor instance for the body.
   * @param {DocSession} docSession Server session control / manager.
   * @param {boolean} [manageEnabledState = true] Flag that determines whether
   *   (`true`) or not (`false`) this instance should automatically manage the
   *   "enabled" state of `quill`. If `false`, it is up to clients of this class
   *   to use `quill.enable()` and `quill.disable()`.
   * @param {Int} [pollingDelayMsec = 0] Delay in msecs to wait before
   *   transitioning from `wantInputAfterDelay` to `wantInput`.
   */
  constructor(quill, docSession, manageEnabledState = true, pollingDelayMsec = 0) {
    super('detached', docSession.log);

    /** {Quill} Editor object. */
    this._quill = quill;

    /** {DocSession} Server session control / manager. */
    this._docSession = DocSession.check(docSession);

    /**
     * {boolean} Whether this instance should manage {@link #_quill}'s enabled /
     * disabled state.
     */
    this._manageEnabledState = manageEnabledState;

    /** {Int} Delay between polling for changes, 0 by default. */
    this._pollingDelayMsec = pollingDelayMsec;

    /**
     * {boolean} Whether the instance supposed to be running right now. This
     * starts out `false`, becomes `true` in response to {@link #start}, and
     * becomes `false` in response to {@link #stop}.
     */
    this._running = false;

    /**
     * {Condition} Whether this instance believes that editing "should" be
     * enabled. This is based on what has been happening with the server
     * connection (but is not simply the same as whether a server connection has
     * been established).
     */
    this._shouldBeEnabled = new Condition();

    /**
     * {Proxy|null} Local proxy for accessing the server session. Becomes
     * non-`null` during the handling of the `start` event.
     */
    this._sessionProxy = null;

    /**
     * {BodySnapshot|null} Current revision of the document body as received
     * from the server. Becomes non-null once the first snapshot is received
     * from the server.
     */
    this._snapshot = null;

    /**
     * {ChainableEvent|null} Current (most recent) local event emitted by the
     * Quill instance, which has furthermore already been processed by this
     * instance. That is, `_currentEvent.next` (once it resolves) is the first
     * Quill event that this instance has not yet processed. This variable is
     * initialized by getting `_quill.currentEvent` and is generally updated by
     * getting `.next` or `.nextNow` on it.
     */
    this._currentEvent = null;

    /**
     * {boolean} Is there currently a pending (as-yet unfulfilled)
     * `body_getChangeAfter()` request to the server?
     */
    this._pendingChangeAfter = false;

    /**
     * {boolean} Is there currently a pending (as-yet unfulfilled) `await` on
     * the Quill event promise chain?
     */
    this._pendingQuillAwait = false;

    /**
     * {array<Int>} Timestamps of every transition into the `errorWait` state
     * over the last `ERROR_WINDOW_MSEC` msec. This is used to determine if
     * the instance should be considered "unrecoverably" errored.
     */
    this._errorStamps = [];

    if (this._manageEnabledState) {
      // The Quill instance should already be in read-only mode. We explicitly
      // set that here, though, to be safe and resilient.
      quill.disable();
    }
  }

  /**
   * Gets this instance's instantaneously current view on whether editing should
   * be enabled.
   *
   * @see {@link #whenShouldBeDisabled}
   * @see {@link #whenShouldBeEnabled}
   *
   * @returns {boolean} `true` if this instance believes that editing should be
   *   enabled, or `false` if not.
   */
  shouldBeEnabled() {
    return this._shouldBeEnabled.value;
  }

  /**
   * Requests that this instance start interacting with its associated editor
   * and API handler. This method does nothing if the client is already in an
   * active state (including being in the middle of starting).
   */
  start() {
    this.q_start();
  }

  /**
   * Requests that this instance stop running. This method does nothing if the
   * client is already stopped (or in the process of stopping).
   */
  stop() {
    this.q_stop();
  }

  /**
   * As an asynchronous method, returns when editing "should" be disabled, from
   * the perspective of this instance. This method is useful for users of this
   * class which manage the editor's enabled state (that is, construct instances
   * with `manageEnabledState` as `false`).
   *
   * @see {@link #shouldBeEnabled}
   * @see {@link #whenShouldBeEnabled}
   *
   * @returns {boolean} `true` (always), asynchrounously when this instance
   *   believes the editor should be in a disabled state.
   */
  async whenShouldBeDisabled() {
    return this._shouldBeEnabled.whenFalse();
  }

  /**
   * As an asynchronous method, returns when editing "should" be enabled, from
   * the perspective of this instance. This method is useful for users of this
   * class which manage the editor's enabled state (that is, construct instances
   * with `manageEnabledState` as `false`).
   *
   * @see {@link #shouldBeEnabled}
   * @see {@link #whenShouldBeDisabled}
   *
   * @returns {boolean} `true` (always), asynchrounously when this instance
   *   believes the editor should be in an enabled state.
   */
  async whenShouldBeEnabled() {
    return this._shouldBeEnabled.whenTrue();
  }

  //
  // Event type checkers.
  //

  /**
   * Validates an `apiError` event. This indicates that an error was reported
   * back from an API call.
   *
   * @param {string} method Name of the method that was called.
   * @param {InfoError} reason Error reason.
   */
  _check_apiError(method, reason) {
    TString.nonEmpty(method);
    InfoError.check(reason);
  }

  /**
   * Validates a `gotChangeAfter` event. This represents a successful result
   * from the API call `body_getChangeAfter()`.
   *
   * @param {Int} baseRevNum The revision number of {@link #_snapshot} at the
   *   time of the original request.
   * @param {BodyChange} result How to transform `baseSnapshot` to get a later
   *   document revision.
   */
  _check_gotChangeAfter(baseRevNum, result) {
    TInt.check(baseRevNum);
    BodyChange.check(result);
  }

  /**
   * Validates a `gotQuillEvent` event. This indicates that there is at least
   * one event which has been emitted by Quill which has not yet been consumed
   * by this instance (e.g. a text change which is not yet integrated in the
   * given base document). Put another way, this indicates that `_currentEvent`
   * has a resolved `next`.
   *
   * @param {Int} baseRevNum The revision number of {@link #_snapshot} at the
   *   time of the original request.
   */
  _check_gotQuillEvent(baseRevNum) {
    TInt.nonNegative(baseRevNum);
  }

  /**
   * Validates a `gotUpdate` event. This represents a successful result
   * from the API call `body_update()`.
   *
   * @param {BodyDelta} delta The delta that was originally applied.
   * @param {BodyChange} correctedChange The correction to the expected
   *   result as returned from `body_update()`.
   */
  _check_gotUpdate(delta, correctedChange) {
    BodyDelta.check(delta);
    BodyChange.check(correctedChange);
  }

  /**
   * Validates a `nextState` event. This event is used when transitioning
   * through the state `becomeDisabled`, so that it (a) has an event to act on,
   * and (b) know what state to transition to after the act of enabling or
   * disabling.
   *
   * @param {string} stateName The desired next state.
   */
  _check_nextState(stateName) {
    TString.check(stateName);
  }

  /**
   * Validates a `start` event. This is the event that kicks off the client. It
   * is also used to prompt action in the `becomeEnabled` state.
   */
  _check_start() {
    // Nothing to do.
  }

  /**
   * Validates a `stop` event. This is the event that tells the client to stop
   * running.
   */
  _check_stop() {
    // Nothing to do.
  }

  /**
   * Validates a `wantInput` event. This indicates that it is time to solicit
   * input from the server (in the form of document deltas) and from the local
   * Quill instance (in the form of Quill events), but only if the client isn't
   * in the middle of doing something else.
   */
  _check_wantInput() {
    // Nothing to do.
  }

  /**
   * Validates a `wantInputAfterDelay` event.
   *
   * @param {Int} delayMsec Msec to wait before firing `wantInput`.
   */
  _check_wantInputAfterDelay(delayMsec) {
    TInt.nonNegative(delayMsec);
  }

  /**
   * Validates a `wantToUpdate` event. This indicates that it is time to
   * send collected local changes up to the server.
   *
   * @param {Int} baseRevNum The revision number of {@link #_snapshot} at the
   *   time of the original request.
   */
  _check_wantToUpdate(baseRevNum) {
    TInt.check(baseRevNum);
  }

  //
  // Event handlers.
  //
  // These are ordered from most generic to most specific. In particular,
  // `stateName_eventName` is most specific, `stateName_any` is middle-of-the-
  // road, and `any_eventName` is most generic (that is, the last form only gets
  // invoked if neither other form matches).
  //

  /**
   * In any state, handles event `apiError`. This is a "normal" occurrence if
   * the error has to do with the network connection (e.g. the network drops),
   * but is considered unusual (and error-worthy) if it happens for some other
   * reason.
   *
   * @param {string} method Name of the method that was called.
   * @param {InfoError} reason Error reason.
   */
  _handle_any_apiError(method, reason) {
    if (!this._running) {
      // Avoid doing anything if the instance isn't supposed to be running.
      return;
    }

    if (reason instanceof ConnectionError) {
      // It's connection-related and probably no big deal.
      this.log.info(reason.message);
    } else {
      // It's something more dire; could be a bug on either side, for example.
      this.log.error(`Severe synch issue in \`${method}\``, reason);
    }

    // Note the time of the error, which also informs the "unrecoverability"
    // determination immediately below.
    this._addErrorStamp();

    if (this._isUnrecoverablyErrored()) {
      // We've hit the point of unrecoverability. Inform the session and
      // transition into the `unrecoverableError` state. See the documentation
      // on `_handle_unrecoverableError_stop()` for further discussion.
      this._docSession.reportError(reason);
      this._becomeUnrecoverable();
    } else {
      // Wait an appropriate amount of time and then try starting again (unless
      // the instance got `stop()`ed in the mean time). The `start` event will
      // be received in the `errorWait` state, and as such will be handled
      // differently than a clean start from scratch.

      (async () => {
        const delayMsec = (this._errorStamps.length === 1)
          ? FIRST_RESTART_DELAY_MSEC
          : RESTART_DELAY_MSEC;
        await Delay.resolve(delayMsec);
        if (this._running) {
          this.q_start();
        }
      })();

      // Stop the user from trying to do more edits, as they'd get lost, and
      // then hang out in `errorWait` until the above delay completes.
      this._becomeDisabled('errorWait');
    }
  }

  /**
   * Handler for all `error` events (errors that were uncaught by other handlers
   * and which would by default just cause the state machine to die). In this
   * case, we make it turn into an "unrecoverable" error, which is the same as
   * what happens when the instance receives too many API errors.
   *
   * @param {Error} error The error.
   */
  _handle_any_error(error) {
    this.log.error('Unexpected error in handler', error);
    this._becomeUnrecoverable();
  }

  /**
   * In most states, handles event `gotChangeAfter`. This will happen when a
   * server change comes when we're in the middle of handling a local change. As
   * such, it is safe to ignore, because after the local change is integrated,
   * the system will fire off a new `body_getChangeAfter()` request.
   *
   * @param {Int} baseRevNum_unused The revision number of {@link #_snapshot} at
   *   the time of the original request.
   * @param {BodyChange} result_unused How to transform `baseSnapshot` to get a
   *   later document revision.
   */
  _handle_any_gotChangeAfter(baseRevNum_unused, result_unused) {
    // Nothing to do. Stay in the same state.
  }

  /**
   * In most states, handles event `gotQuillEvent`. This will happen when a
   * local change comes in after we're already in the middle of handling a
   * chain of local changes. As such, it is safe to ignore, because whatever
   * the change was, it will get handled by that pre-existing process.
   *
   * @param {Int} baseRevNum_unused The revision number of {@link #_snapshot} at
   *   the time of the original request.
   */
  _handle_any_gotQuillEvent(baseRevNum_unused) {
    // Nothing to do. Stay in the same state.
  }

  /**
   * In most states, handles event `start`.
   */
  _handle_any_start() {
    // This space intentionally left blank: We are already active or in the
    // middle of starting, so there's nothing more to do.
  }

  /**
   * Handler for `stop` events in most states (all of them except for the ones
   * which are active when there are in-flight changes to deal with, and during
   * transition through the `unrecoverableError` state).
   */
  _handle_any_stop() {
    if (this._running) {
      this.log.event.stopped();
      this._running = false;
    }

    // As soon as we're trying to stop, we should prevent the user from doing
    // any editing. And having disabled editing, we should just go back to being
    // in the `detached` state. In that state, additional incoming events will
    // get ignored, except for `start` which will bring the client back to life.
    this._becomeDisabled('detached');
  }

  /**
   * In any state but `idle`, handles event `wantInput`. We ignore the event,
   * because the client is in the middle of doing something else. When it's done
   * with whatever it may be, it will send a new `wantInput` event.
   */
  _handle_any_wantInput() {
    // Nothing to do. Stay in the same state.
  }

  /**
   * In any state but `idle`, handles event `wantInputAfterDelay`. We ignore
   * the event, because the client is in the middle of doing something else.
   * When it's done with whatever it may be, it will send a new
   * `wantInputAfterDelay` event.
   */
  _handle_any_wantInputAfterDelay() {
    // Nothing to do.
  }

  /**
   * In state `errorWait`, handles all events.
   *
   * @param {string} name The event name.
   * @param {...*} args The event arguments.
   */
  _handle_errorWait_any(name, ...args) {
    // This space intentionally left blank (except for logging): We might get
    // "zombie" events from a connection that's shuffling towards doom. But even
    // if so, we will already have set up a timer to reset the connection.
    this.log.event.eventWhenErrorWait(new Functor(name, ...args));
  }

  /**
   * In state `becomeDisabled`, handles event `nextState`. This is where the
   * Quill instance gets disabled, but only if this instance is managing the
   * enabled state (depends on a constructor parameter); if not, it is during a
   * transition to this state that clients of this class should tell the Quill
   * instance to become disabled. In either case, this instance immediately
   * transitions into the indicated state.
   *
   * @param {function} stateName The name of the state to transition into.
   */
  _handle_becomeDisabled_nextState(stateName) {
    this.log.event.becameDisabled();

    if (this._manageEnabledState) {
      this._quill.disable();
    }

    this._shouldBeEnabled.value = false;
    this.state = stateName;
  }

  /**
   * In state `becomeEnabled`, handles event `start`. This is where the Quill
   * instance gets enabled, but only if this instance is managing the enabled
   * state (depends on a constructor parameter); if not, it is during a
   * transition to this state that clients of this class should tell the Quill
   * instance to become enabled. In either case, this instance immediately
   * transitions into the `idle` state after handling this event.
   */
  _handle_becomeEnabled_start() {
    this.log.event.becameEnabled();

    if (this._manageEnabledState) {
      this._quill.enable();

      // Focus the editor area so the user can start typing right away
      // rather than make them have to click-to-focus first.
      QuillUtil.editorDiv(this._quill).focus();
    }

    this._shouldBeEnabled.value = true;

    // Head into our first post-connection iteration of idling while waiting for
    // changes coming in locally (from Quill) or from the server.
    this._becomeIdle();
  }

  /**
   * In state `collecting`, handles event `stop`. This one is slightly tricky,
   * in that we already have some local changes which are in-flight and
   * shouldn't just be dropped on the floor. See {@link #_waitThenStop} for
   * additional flavor about what's going on.
   */
  _handle_collecting_stop() {
    this._waitThenStop();
  }

  /**
   * In state `collecting`, handles event `wantToUpdate`. This means that it
   * is time for the collected local changes to be sent up to the server for
   * integration.
   *
   * @param {Int} baseRevNum The revision number of {@link #_snapshot} at the
   *   time of the original request.
   */
  _handle_collecting_wantToUpdate(baseRevNum) {
    if (this._snapshot.revNum !== baseRevNum) {
      // As with the `gotQuillEvent` event, we ignore this event if the document
      // has changed out from under us.
      this._becomeIdle();
      return;
    }

    // Build up a combined (composed) delta of all of the changes starting just
    // after the last integrated change (the last change that was sent to the
    // server) through the current (latest) change. This _excludes_
    // internally-sourced changes, because we will handle those on the next
    // iteration (from the idle state).
    const delta = this._consumeLocalChanges(false);

    if (delta.isEmpty()) {
      // There weren't actually any net changes. This is unusual, though
      // possible. In particular, the user probably typed something and then
      // undid it.
      this._becomeIdle();
      return;
    }

    // Send the change, and handle the response. **Note:** In the section above,
    // we established that the current snapshot, `this._snapshot`, is the same
    // as the snapshot bundled with the event, `baseSnapshot`. In the following
    // we use the latter and not the former because in the time between when we
    // queue up the `async` block and when it executes, it's possible for
    // `this._snapshot` to change, which would lead to an incorrect call to
    // `body_update()`. `baseSnapshot`, on the other hand, is a local variable
    // which we can see (in this function) cannot possibly be modified, and so
    // it's arguably a safer way to reference the snapshot in question. By
    // inspection -- today! -- it doesn't look like the sort of hazard described
    // above could ever happen in practice, but the choice below may help avoid
    // future bugs, in the face of possible later changes to this class.
    (async () => {
      try {
        const value = await this._sessionProxy.body_update(baseRevNum, delta);
        this.q_gotUpdate(delta, value);
      } catch (e) {
        // **TODO:** Remove this logging once we figure out why we're seeing
        // this error.
        this.log.event.badCompose(this._snapshot, delta);
        this.q_apiError('body_update', e);
      }
    })();

    this.s_merging();
  }

  /**
   * In state `detached`, handles event `start`.
   *
   * This is the kickoff event.
   */
  async _handle_detached_start() {
    // **TODO:** This whole flow should probably be protected by a timeout.

    this._running = true;

    // Open (or reopen) the connection to the server, and perform any necessary
    // handshaking to gain access to the document.
    try {
      this._sessionProxy = await this._docSession.getSessionProxy();
    } catch (e) {
      this.q_apiError('getSessionProxy', e);
      return;
    }

    // Get log metainfo for the session (so we can log it here on the client
    // side), and get the first snapshot. We issue the calls in parallel and
    // then handle the results.

    const sessionProxy    = this._sessionProxy;
    const infoPromise     = sessionProxy.getLogInfo();
    const snapshotPromise = sessionProxy.body_getSnapshot();

    try {
      const info = await infoPromise;
      this.log.event.sessionInfo(info);
    } catch (e) {
      this.q_apiError('getLogInfo', e);
      return;
    }

    let snapshot;
    try {
      snapshot = await snapshotPromise;
    } catch (e) {
      this.q_apiError('snapshot', e);
      return;
    }

    // Save the result as the current (latest known) revision of the document,
    // and tell Quill about it. **TODO:** In the case where we are recovering
    // from network trouble, it's possible that `_quill`'s content contains
    // changes that were never successfully reported to the server. In such
    // cases, instead of calling `_updateWithSnapshot()` -- which will lose
    // whatever work hadn't been reported -- we should reproduce the change
    // request that was in progress.
    const firstEvent = this._quill.currentEvent;
    this._updateWithSnapshot(snapshot);

    // The above action should have caused the Quill instance to make a change
    // which shows up on its event chain. Grab it, and verify that indeed it's
    // the change we're expecting.
    const firstChange = firstEvent.nextOfNow(QuillEvents.TYPE_textChange);

    if (firstChange === null) {
      // This can happen if the snapshot happened to coincide with the
      // placeholder text originally set up in Quill's `<div>`. If there was no
      // placeholder text, this can happen if the snapshot was totally empty. In
      // either case, it's safe to just initialize this instance's notion of the
      // "current event" with whatever Quill happens to report.
      this._currentEvent = firstEvent;
    } else {
      const source = QuillEvents.propsOf(firstChange).source;
      if (source !== CLIENT_SOURCE) {
        // We expected the change to be the one we generated from the document
        // update (above), but the `source` we got speaks otherwise.
        throw Errors.wtf('Bad `source` for initial change.');
      }

      // With the Quill setup verified, remember the change as our local "head"
      // as the most recent change we've dealt with.
      this._currentEvent = firstChange;
    }

    // And with that, it's now safe to enable Quill so that it will accept user
    // input, if editing is enabled.
    this.s_becomeEnabled();
    this.q_start();
  }

  /**
   * In state `errorWait`, handles event `start`. This resets the internal
   * state and then issues a `start` event as if from the `detached` state.
   *
   * **TODO:** Ultimately this should be able to pick up the pieces of any
   * changes that were in-flight when the connection became problematic.
   */
  _handle_errorWait_start() {
    this._snapshot           = null;
    this._sessionProxy       = null;
    this._currentEvent       = null;
    this._pendingChangeAfter = false;
    this._pendingQuillAwait  = false;

    // After this, it's just like starting from the `detached` state.
    this.s_detached();
    this.q_start();
  }

  /**
   * In state `idle`, handles event `gotChangeAfter`.
   *
   * @param {Int} baseRevNum The revision number of {@link #_snapshot} at the
   *   time of the original request.
   * @param {BodyChange} result How to transform `baseSnapshot` to get a later
   *   document revision.
   */
  _handle_idle_gotChangeAfter(baseRevNum, result) {
    // We only take action if (a) the result's base (what the change is with
    // regard to) is the current `_snapshot`, _and_ (b) if the `Quill` instance
    // has no additional changes to its document state beyond what's in
    // `_snapshot`. If (a) _isn't_ the case, then what we have here is a stale
    // response of one sort or another. For example (and most likely), it might
    // be the delayed result from an earlier iteration. If (b) isn't the case,
    // then there will soon be a `gotQuillEvent` event to be handled by this
    // instance, and after that gets done, it will once again be okay to
    // integrate changes from the server.
    if (this._snapshot.revNum === baseRevNum) {
      // **TODO:** For now, we make the check for `_isQuillChangePending()`
      // separately (instead of making the outer if have an `&&`), so that we
      // can explicitly do some logging around the is-pending case. This is
      // because (historically speaking) while always arguably incorrect to fail
      // to perform this check, it only recently started causing problems in
      // practice. We want to log in order to understand more about when the
      // situation arises, in case it is a harbinger of some other nascent new
      // problem.
      if (this._isQuillChangePending()) {
        const thisSnap   = this._snapshot;
        const quillDelta = BodyDelta.fromQuillForm(this._quill.getContents());
        const quillSnap  = new BodySnapshot(thisSnap.revNum + 1, quillDelta);
        const diff       = thisSnap.diff(quillSnap);
        this.log.event.quillChangePending(diff);
        this._sessionProxy.logEvent('quillChangePending', diff); // Log it on the server too.
      } else {
        this._updateWithChange(result);
      }
    }

    // Fire off the next iteration of requesting server changes, after a short
    // delay. The delay is just to keep network traffic at a stately pace
    // despite any particularly active editing by other clients. Use delay
    // at least as long as `PULL_DELAY_MSEC`.
    this.q_wantInputAfterDelay(this._pollingDelayMsec < PULL_DELAY_MSEC ? PULL_DELAY_MSEC : this._pollingDelayMsec);
  }

  /**
   * In state `idle`, handles event `gotQuillEvent`. This means that the local
   * user is actively editing (or at least moving the caret around). We prepare
   * to collect the changes for a short period of time before sending them up to
   * the server.
   *
   * @param {Int} baseRevNum The revision number of {@link #_snapshot} at the
   *   time of the original request.
   */
  _handle_idle_gotQuillEvent(baseRevNum) {
    const event = this._currentEvent.nextNow;

    if ((this._snapshot.revNum !== baseRevNum) || (event === null)) {
      // This state machine event was generated with respect to a revision of
      // the document which has since been updated, or we ended up having two
      // state machine events for the same Quill event (which can happen for at
      // least a couple reasons, notably including (a) if the user is
      // particularly chatty or (b) during recovery from a server timeout) and
      // this handler lost the race. That is, this is a stale request for
      // changes. Go back to idling (which very well might end up issuing a new
      // request for changes).
      this._becomeIdle();
      return;
    }

    const props = QuillEvents.propsOf(event);

    if (props.source === CLIENT_SOURCE) {
      // The Quill event was generated because of action taken by this class. We
      // don't want to act on it (and perhaps ultimately try to propagate it
      // back to the server), lest we end up in a crazy feedback loop. Since
      // we're in state `idle`, we know there aren't any pending changes to
      // worry about, so we just ignore the change (skip it in the event chain)
      // and go back to idling.
      this._currentEvent = event;
      this._becomeIdle();
      return;
    }

    switch (event.payload.name) {
      case QuillEvents.TYPE_textChange: {
        // It's a document modification. Go into state `collecting`, leaving the
        // event chain alone for now. After the prescribed amount of time, the
        // `collecting` handler will hoover up the event with any other edits
        // that happened in the mean time.
        (async () => {
          await Delay.resolve(PUSH_DELAY_MSEC);
          this.q_wantToUpdate(baseRevNum);
        })();

        this.s_collecting();
        return;
      }

      case QuillEvents.TYPE_selectionChange: {
        // Consume the event, and send it onward to the caret tracker, which
        // might ultimately inform the server about it. Then go back to idling.
        if (props.range) {
          this._docSession.caretTracker.update(this._snapshot.revNum, props.range);
        }
        this._currentEvent = event;
        this._becomeIdle();
        return;
      }

      default: {
        // As of this writing, there are no other kinds of Quill events, so it's
        // weird and unexpected that we landed here.
        throw Errors.wtf('Weird Quill event:', event.payload);
      }
    }
  }

  /**
   * In state `idle`, handles event `wantInput`. This can happen as a chained
   * event (during startup or at the end of handling the integration of changes)
   * or due to a delay timeout. This will make requests both to the server and
   * to the local Quill instance.
   */
  _handle_idle_wantInput() {
    // We grab the current revision number immediately, so we can refer back to
    // it when a response comes. That is, `_snapshot` might have changed out
    // from under us between when this event is handled and when the promises
    // used here become resolved.
    const baseRevNum = this._snapshot.revNum;

    // Ask Quill for any changes we haven't yet observed, via the document
    // change promise chain, but only if there isn't already a pending request
    // for same. (Otherwise, we would unnecessarily build up redundant promise
    // resolver functions when changes are coming in from the server while the
    // local user is idle.)
    if (!this._pendingQuillAwait) {
      this._pendingQuillAwait = true;

      // **Note:** As of this writing, Quill will never reject (report an error
      // on) a document change promise.
      (async () => {
        await this._currentEvent.next;
        this._pendingQuillAwait = false;
        this.q_gotQuillEvent(baseRevNum);
      })();
    }

    // Ask the server for any changes, but only if there isn't already a pending
    // request for same. (Otherwise, we would flood the server for new change
    // requests while the local user is updating the document.)
    if (!this._pendingChangeAfter) {
      this._pendingChangeAfter = true;

      (async () => {
        try {
          const value = await this._sessionProxy.body_getChangeAfter(baseRevNum);
          this._pendingChangeAfter = false;
          this.q_gotChangeAfter(baseRevNum, value);
        } catch (e) {
          this._pendingChangeAfter = false;
          if (Errors.is_timedOut(e)) {
            // Emit `wantInputAfterDelay` in response to a timeout. If we're
            // idling, this will end up retrying the `getChangeAfter()` after
            // a configured delay. In any other state, it will (correctly)
            // get ignored.
            this.q_wantInputAfterDelay(this._pollingDelayMsec);
          } else {
            // Any other thrown error is a bona fide problem.
            this.q_apiError('body_getChangeAfter', e);
          }
        }
      })();
    }
  }

  /**
   * In state `idle`, handles event `wantInputAfterDelay`. Will fire `wantInput`
   * after a configured delay, which will make requests both to the server and
   * to the local Quill instance.
   *
   * @param {Int} delayMsec Msec to wait before firing `wantInput`.
   */
  async _handle_idle_wantInputAfterDelay(delayMsec) {
    // Fire off the next iteration of requesting server changes, after a delay.
    if (delayMsec !== 0) {
      await Delay.resolve(delayMsec);
    }

    this.q_wantInput();
  }

  /**
   * In state `merging`, handles event `gotUpdate`. This means that a local
   * change was successfully merged by the server.
   *
   * @param {BodyDelta} delta The delta that was originally applied.
   * @param {BodyChange} correctedChange The correction to the expected
   *   result as returned from `body_update()`.
   */
  _handle_merging_gotUpdate(delta, correctedChange) {
    // These are the same variable names as used on the server side. See below
    // for more detail.
    const dCorrection = correctedChange.delta;
    const vResultNum  = correctedChange.revNum;

    if (dCorrection.isEmpty()) {
      // There is no change from what we expected. This means that no other
      // client got in front of us between when we received the current revision
      // and when we sent the delta to the server. And _that_ means it's safe to
      // update the client's revision of the current document and go back to
      // idling.
      //
      // In particular, if there happened to be any local changes made (coming
      // from Quill) while the server request was in flight, they will be picked
      // up promptly due to the handling of the `wantInput` event which will
      // get fired off immediately.
      //
      // And note that Quill doesn't need to be updated here (that is, its delta
      // is empty) because what we are integrating into the client document is
      // exactly what Quill handed to us.
      this._updateWithChange(new BodyChange(vResultNum, delta), BodyDelta.EMPTY);
      this._becomeIdle();
      return;
    }

    // The server merged in some changes that we didn't expect.

    // This "corrected delta" consists of the original combined delta that we
    // got from Quill (that is, representing a delta from the client's current
    // state to Quill's current state) composed with the correction to that
    // delta which when applied brings the client's state into alignment with
    // the server's state.
    const correctedDelta = delta.compose(dCorrection, false);

    if (!this._isQuillChangePending()) {
      // Thanfully, the local user hasn't made any other changes while we
      // were waiting for the server to get back to us, which means we can
      // cleanly apply the correction on top of Quill's current state.
      this._updateWithChange(
        new BodyChange(vResultNum, correctedDelta), dCorrection);
      this._becomeIdle();
      return;
    }

    // The hard case, a/k/a "Several people are typing." The server got back
    // to us with a response that included changes we didn't know about, *and*
    // in the mean time the local user has been busy making changes of their
    // own. We need to "transform" (in OT terms) or "rebase" (in git terms) the
    // the local changes to be on top of the new base document as provided by
    // the server.
    //
    // Using the same terminology as used on the server side (see
    // `BodyControl.js`), we start with `vExpected` (the document we would have
    // had if the server hadn't included extra changes) and `dCorrection` (the
    // delta given back to us from the server which can be applied to
    // `vExpected` to get the _actual_ next revision). From that, here's what we
    // do:
    //
    // 1. Get all of the changes that the user made (that is, that Quill
    //    recorded) while the server update was in progress. This is
    //    `dMore`.
    // 2. Construct a delta which integrates `dCorrection` "underneath"
    //    `dMore`, yielding `dIntegratedCorrection`. This can be applied to
    //    Quill's current document state, yielding a document that includes
    //    the server's current state along with `dMore`. Update both the
    //    local document model and Quill to include the changes from the
    //    server. At this point, the local document still doesn't know about
    //    `dMore`.
    // 3. Transform (rebase) `dMore` with regard to (on top of)
    //    `dCorrection`, yielding `dNewMore` This is the delta which can be
    //    sent back to the server as a change that captures the new local
    //    changes. Instead of sending it directly here, construct a
    //    "synthetic" value for `_currentEvent.nextNow`, and hook it up
    //    so that it will get noticed once we go back into the `idle` state.

    // (1)
    const dMore = this._consumeLocalChanges(true);

    // (2)

    // `false` indicates that `dMore` should be taken to have been applied
    // second (lost any insert races or similar).
    const dIntegratedCorrection = dMore.transform(dCorrection, false);
    this._updateWithChange(
      new BodyChange(vResultNum, correctedDelta), dIntegratedCorrection);

    // (3)

    // The `true` argument indicates that `dCorrection` should be taken to
    // have been applied first (won any insert races or similar). **Note:**
    // `dNewMore` and `dIntegratedCorrection` (above) are approximately
    // "complements" of each other.
    const dNewMore = dCorrection.transform(dMore, true);

    // This is the synthetic document change which substitutes for the changes
    // that we consumed to construct `dMore` above. We use `user` for the
    // source and not `CLIENT_SOURCE` because, even though we are in fact
    // making this change here (per se), the changes notionally came from
    // the user, and as such we _don't_ want to ignore the change. We use
    // `EMPTY` for the old contents, because this code doesn't care about that
    // value at all
    const nextNow = this._currentEvent.withNewPayload(
      new Functor(QuillEvents.TYPE_textChange, dNewMore, BodyDelta.EMPTY, QuillEvents.SOURCE_user));

    // Make a new head of the change chain which points at the `nextNow` we
    // just constructed above. We don't include any payload since this class
    // never actually looks at the payload of `_currentEvent`.
    this._currentEvent = nextNow.withPushedHead();

    this._becomeIdle();
  }

  /**
   * In state `merging`, handles event `stop`. The situation here is the same as
   * with {@link #_handle_collecting_stop} (see which for details).
   */
  _handle_merging_stop() {
    this._waitThenStop();
  }

  /**
   * In state `unrecoverableError`, handles the `stop` event. This event is set
   * up to be immediately dispatched to this state, and this is immediately
   * responded to by transitioning into the `detached` state. The point of the
   * transition to `unrecoverableError` is so that clients of this class can
   * detect it (e.g. via `when_unrecoverableError()`) and take action based on
   * that transition. Once in the `detached` state, it is valid to call
   * {@link #start} to try to reinitiate a connection and reconnect (or
   * recreate) the session.
   *
   * **Note:** The name of the state is meant to suggest that _this class_
   * considers things to be unrecoverable, not that things are quite so dire in
   * the larger context.
   */
  _handle_unrecoverableError_stop() {
    this.log.event.nowUnrecoverable();

    // Stop the user from trying to do more edits, as they'd get lost, and then
    // transition into `detached`.
    this._becomeDisabled('detached');
  }

  //
  // Private methods (which aren't part of the state machine definition).
  //

  /**
   * Trim the error timestamp list of any errors that have "aged out," and add
   * a new one for the current moment in time.
   */
  _addErrorStamp() {
    const now     = Date.now();
    const agedOut = now - ERROR_WINDOW_MSEC;

    this._errorStamps = this._errorStamps.filter(value => (value >= agedOut));
    this._errorStamps.push(now);
  }

  /**
   * Sets up the client to transition through the `becomeDisabled` state to
   * another specified state. This transition is what clients of this class can
   * listen to, in order for them to trigger the actual disabling of the Quill
   * instance.
   *
   * @param {string} nextState The state to transition to after (briefly) being
   *   in the `becomeDisabled` state.
   */
  _becomeDisabled(nextState) {
    this.s_becomeDisabled();
    this.p_nextState(nextState);
  }

  /**
   * Sets up the client to idle while waiting for input. Or, if the client has
   * been asked to stop, this is the safe point where we can transition back
   * into the `detached` state.
   */
  _becomeIdle() {
    if (this._running) {
      this.s_idle();
      this.q_wantInputAfterDelay(this._pollingDelayMsec);
    } else {
      this.s_detached();
    }
  }

  /**
   * Sets up the client to transition into the `unrecoverableError` state and
   * then become `detached`.
   */
  _becomeUnrecoverable() {
    // Set the state, and push a `stop` to the front of the queue, which is the
    // one event that the state can handle and expects.
    this.s_unrecoverableError();
    this.p_stop();
  }

  /**
   * Gets a combined (composed) delta of all document changes that have been
   * made to the Quill instance since the last time changes were integrated into
   * the server revision of the document, optionally stopping at (and not
   * including) changes whose source is `CLIENT_SOURCE` (that is, this class).
   * Updates `_currentEvent` to indicate that all of these changes have in
   * fact been consumed.
   *
   * @param {boolean} includeOurChanges If `true` indicates that changes with
   *   source `CLIENT_SOURCE` _should_ be included.
   * @returns {BodyDelta} A combined delta of all the salient changes. This
   *   will be empty if there are no such changes (that is, if this class's
   *   document model is up-to-date with respect to Quill).
   */
  _consumeLocalChanges(includeOurChanges) {
    let delta = null;

    let change = this._currentEvent;
    for (;;) {
      const nextNow = change.nextOfNow(QuillEvents.TYPE_textChange);
      if (nextNow === null) {
        break;
      }

      change = nextNow;
      const props = QuillEvents.propsOf(change);
      if (!(includeOurChanges || (props.source !== CLIENT_SOURCE))) {
        break;
      }

      delta = (delta === null) ? props.delta : delta.compose(props.delta, false);
    }

    // Remember that we consumed all these changes.
    this._currentEvent = change;

    return delta;
  }

  /**
   * Determine whether the current set of error timestamps means that the
   * instance is unrecoverably errored.
   *
   * @returns {boolean} `true` iff the instance is unrecoverably errored.
   */
  _isUnrecoverablyErrored() {
    const stamps       = this._errorStamps;
    const total        = stamps.length;
    const perMinuteRaw = (total / ERROR_WINDOW_MSEC) * 60 * 1000;
    const perMinute    = Math.round(perMinuteRaw * 100) / 100;

    if (total === 0) {
      // Shouldn't happen, but might as well just avoid weird math below in case
      // it does.
      return false;
    }

    const startTime = stamps[0];
    const endTime   = stamps[total - 1];
    const period    = endTime - startTime;
    const periodSec = Math.floor(period / 1000);

    this.log.event.errorWindow({ periodSec, total, perMinute });

    return (perMinute >= ERROR_MAX_PER_MINUTE)
      && (period >= ERROR_STATE_MIN_TIME_MSEC);
  }

  /**
   * Determines if there is at least one change to the document which the
   * associated `Quill` instance has made and which this instance has not yet
   * processed into its local snapshot.
   *
   * @returns {boolean} `true` if there is a pending (as-yet unprocessed) change
   *   in the `Quill` instance, or `false` if not.
   */
  _isQuillChangePending() {
    // This asks: Is there an unprocessed `textChange` event on the event chain?
    return this._currentEvent.nextOfNow(QuillEvents.TYPE_textChange) !== null;
  }

  /**
   * Updates {@link #_snapshot} to be the given revision by applying the
   * indicated change to the current revision, and tells the attached `Quill`
   * instance to update itself accordingly.
   *
   * This is only valid to call when the revision of the document that Quill has
   * is the same as what is represented in {@link #_snapshot} _or_ if
   * `quillDelta` is passed as an empty delta. That is, this is only valid when
   * the `Quill` instance's revision of the document doesn't need to be updated.
   * If that isn't the case, then this method will throw an error.
   *
   * @param {BodyChange} change Change from the current {@link #_snapshot}
   *   contents.
   * @param {BodyDelta} [quillDelta = change.delta] Delta from the `Quill`
   *   instance's current state, which is expected to preserve any state that
   *   Quill has that isn't yet represented in {@link #_snapshot}. This must be
   *   used in cases where the `Quill` instance state has progressed ahead of
   *   {@link #_snapshot} due to local activity.
   */
  _updateWithChange(change, quillDelta = change.delta) {
    const needQuillUpdate = !quillDelta.isEmpty();

    if (this._isQuillChangePending() && needQuillUpdate) {
      // It is unsafe to apply the change as-is, because we know that Quill's
      // revision of the document has diverged.
      throw Errors.badUse('Cannot apply change due to revision skew.');
    }

    // Update the local snapshot.
    this._snapshot = BodyClient._validateSnapshot(this._snapshot.compose(change));

    // Tell Quill if necessary.
    if (needQuillUpdate) {
      // The `cutoff()` calls force the update to be treated as an atomic "undo"
      // item that will not get combined with edits that the local user has
      // made. **Note:** As of this writing, `cutoff()` is listed in the Quill
      // docs as an "experimental" feature. As such, we only call it if it is
      // available. **TODO:** When (hopefully!) it is fully supported, remove
      // the checks.
      const hasCutoff = (this._quill.history.cutoff !== undefined);

      if (hasCutoff) {
        this._quill.history.cutoff();
      }

      this._quill.updateContents(quillDelta.toQuillForm(), CLIENT_SOURCE);

      if (hasCutoff) {
        this._quill.history.cutoff();
      }
    }
  }

  /**
   * Updates `_snapshot` to be the given snapshot, and tells the attached Quill
   * instance to update itself accordingly.
   *
   * @param {BodySnapshot} snapshot New snapshot.
   */
  _updateWithSnapshot(snapshot) {
    const selection = this._quill.getSelection();

    this._snapshot = BodyClient._validateSnapshot(snapshot);
    this._quill.setContents(snapshot.contents.toQuillForm(), CLIENT_SOURCE);

    if (selection) {
      // Preserve the previous selection (caret) across the content update. It
      // will have been set if we are currently re-setting up the content after
      // a disconnect / reconnect. Without doing this, the selection would just
      // be reset to the start of the document (because that's what
      // `setContents()` does). What we do here -- setting it to exactly what it
      // was before -- is optimistic in that it's possible that the document
      // could have changed in between the disconnect and reconnect, but it's
      // also reasonable because much of the time it'll turn out either to be
      // correct or not to matter. **TODO:** If we wanted to be cleverer, we
      // could note the revision numbers of the before and after snapshots and
      // do some OT operations (if they don't match) to transform the selection
      // to the new state.
      this._quill.setSelection(selection);
    }

    // This prevents "undo" from backing over the snapshot. When first starting
    // up, this means the user can't undo and find themselves looking at the
    // "loading..." text. And during a reconnection, it prevents hard-to-predict
    // glitches (in that the Quill state could have diverged significantly from
    // the stored document state).
    this._quill.history.clear();
  }

  /**
   * Validates a snapshot. This performs validation that goes beyond the
   * baseline requirements of `BodySnapshot` construction. This method returns
   * `snapshot` itself if it is valid, or throws an error if a problem is
   * detected.
   *
   * As of this writing, the only thing specifically detected by this method is
   * if `snapshot` doesn't end with a newline character (including detecting
   * a truly "empty" document). Quill is supposed to maintain the invariants
   * that (a) all lines are newline-terminated, and (b) every document contains
   * at least one line.
   *
   * @param {BodySnapshot} snapshot Snapshot to validate.
   * @returns {BodySnapshot} `snapshot`, if it is indeed valid.
   * @throws {Error} Thrown if `snapshot` is problematic.
   */
  static _validateSnapshot(snapshot) {
    BodySnapshot.check(snapshot);

    const ops = snapshot.contents.ops;

    if (ops.length === 0) {
      throw Errors.badData('Totally empty snapshot.');
    }

    // The last op had better be a `text` which ends with a newline.

    const lastOp = ops[ops.length - 1];
    const props  = lastOp.props;

    if (props.opName !== BodyOp.CODE_text) {
      throw Errors.badData(`Snapshot without final newline. Has \`${props.opName}\` op instead.`);
    } else if (!props.text.endsWith('\n')) {
      throw Errors.badData('Snapshot without final newline.');
    }

    return snapshot;
  }

  /**
   * Waits a moment and then issues a `stop` event. This is used when a `stop`
   * event gets handled during a high-level operation that spans multiple events
   * (most notably collecting local changes and getting them saved on the
   * server).
   *
   * Rather than get too fancy trying to do some kind of unwinding of the
   * operation, what's going on is that we let the operation complete, at which
   * point it's safe to stop. If it turns out we didn't wait long enough before
   * re-issuing the `stop`, we'll just end up back here for another try.
   */
  _waitThenStop() {
    // **Note:** We do this in an immediate-async block so as to make this
    // method return promptly. Its callers in fact want to be able to proceed
    // with event processing in the mean time.
    (async () => {
      this.log.event.waitingBeforeStopping();
      await Delay.resolve(STOP_POLL_DELAY_MSEC);
      this.q_stop();
    })();

    // Bounce into the `becomeDisabled` state, to perform the actual acts of
    // disabling, and then return to whatever state we're in now, so as to
    // complete the pending action.
    this._becomeDisabled(this.state);
  }
}
