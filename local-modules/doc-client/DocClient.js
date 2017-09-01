// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ApiError } from 'api-client';
import { DocumentDelta, DocumentSnapshot, FrozenDelta } from 'doc-common';
import { Delay } from 'promise-util';
import { QuillEvent } from 'quill-util';
import { TString } from 'typecheck';
import { StateMachine } from 'state-machine';

import DocSession from './DocSession';

/**
 * {Int} Amount of time in msec over which errors are counted, in order to
 * determine that an instance is in an "unrecoverable" error state.
 */
const ERROR_WINDOW_MSEC = 3 * 60 * 1000; // Three minutes.

/**
 * {number} Error rate, expressed in errors per minute, above which constitutes
 * sufficient evidence that the instance is in an "unrecoverable" error state.
 */
const ERROR_MAX_PER_MINUTE = 2.25;

/**
 * How long to wait (in msec) after receiving a local change (to allow time for
 * other changes to get coalesced) before pushing a change up to the server.
 */
const PUSH_DELAY_MSEC = 1000;

/**
 * How long to wait (in msec) after receiving a server change (to allow time for
 * other changes to get coalesced) before requesting additional changes from
 * the server.
 */
const PULL_DELAY_MSEC = 1000;

/**
 * How long to wait (in msec) after detecting an error, before attempting to
 * restart.
 */
const RESTART_DELAY_MSEC = 10000;

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
 * This is because of how the `deltaAfter()` API method is defined.
 * Specifically, that method does not return a result until at least one change
 * has been made. This means that the client can make that API call and then
 * just wait until it comes back with a result, instead of having to set up a
 * low-duration timeout to repeatedly ask for new changes.
 */
export default class DocClient extends StateMachine {
  /**
   * Constructs an instance. It is initially in state `detached`. The
   * constructed instance expects to be the primary non-human controller of the
   * Quill instance it manages.
   *
   * @param {QuillProm} quill Quill editor instance.
   * @param {DocSession} docSession Server session control / manager.
   */
  constructor(quill, docSession) {
    super('detached', docSession.log);

    /** {Quill} Editor object. */
    this._quill = quill;

    /** {DocSession} Server session control / manager. */
    this._docSession = DocSession.check(docSession);

    /** {ApiClient} API interface. */
    this._apiClient = docSession.apiClient;

    /** {Logger} Logger specific to this client's session. */
    this._log = docSession.log;

    /**
     * {Proxy|null} Local proxy for accessing the server session. Becomes
     * non-`null` during the handling of the `start` event.
     */
    this._sessionProxy = null;

    /**
     * {DocumentSnapshot|null} Current revision of the document as received from
     * the server. Becomes non-null once the first snapshot is received from the
     * server.
     */
    this._doc = null;

    /**
     * {QuillEvent|object} Current (most recent) local change to the document
     * made by Quill that this instance is aware of. That is,
     * `_currentEvent.nextOf(TEXT_CHANGE)` (once it resolves) is the first
     * change that this instance has not yet processed. This variable is
     * initialized by getting `_quill.currentEvent` and is generally updated by
     * getting the next `TEXT_CHANGE` on it. In a couple cases, though, instead
     * of being a `QuillEvent` per se, it is a "manually" constructed object
     * with a payload compatible for use within this class; these are used very
     * transiently to handle multi-way change merging.
     */
    this._currentEvent = null;

    /**
     * {boolean} Is there currently a pending (as-yet unfulfilled)
     * `deltaAfter()` request to the server?
     */
    this._pendingDeltaAfter = false;

    /**
     * {boolean} Is there currently a pending (as-yet unfulfilled) request for a
     * new local change via the Quill document change promise chain?
     */
    this._pendingLocalDocumentChange = false;

    /**
     * {array<Int>} Timestamps of every transition into the `errorWait` state
     * over the last `ERROR_WINDOW_MSEC` msec. This is used to determine if
     * the instance should be considered "unrecoverably" errored.
     */
    this._errorStamps = [];

    // The Quill instance should already be in read-only mode. We explicitly
    // set that here, though, to be safe and resilient.
    quill.disable();
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
   * Validates an `apiError` event. This indicates that an error was reported
   * back from an API call.
   *
   * @param {string} method Name of the method that was called.
   * @param {ApiError} reason Error reason.
   */
  _check_apiError(method, reason) {
    TString.nonempty(method);
    ApiError.check(reason);
  }

  /**
   * Validates a `gotApplyDelta` event. This represents a successful result
   * from the API call `applyDelta()`.
   *
   * @param {FrozenDelta} delta The delta that was originally applied.
   * @param {DocumentDelta} correctedChange The correction to the expected
   *   result as returned from `applyDelta()`.
   */
  _check_gotApplyDelta(delta, correctedChange) {
    FrozenDelta.check(delta);
    DocumentDelta.check(correctedChange);
  }

  /**
   * Validates a `gotDeltaAfter` event. This represents a successful result
   * from the API call `deltaAfter()`.
   *
   * @param {DocumentSnapshot} baseDoc The document at the time of the original
   *   request.
   * @param {DocumentDelta} result How to transform `baseDoc` to get a later
   *   document revision.
   */
  _check_gotDeltaAfter(baseDoc, result) {
    DocumentSnapshot.check(baseDoc);
    DocumentDelta.check(result);
  }

  /**
   * Validates a `gotLocalDelta` event. This indicates that there is at least
   * one local change that Quill has made to its document which is not yet
   * reflected in the given base document. Put another way, this indicates that
   * `_currentEvent` has a resolved `next`.
   *
   * @param {DocumentSnapshot} baseDoc The document at the time of the original
   *   request.
   */
  _check_gotLocalDelta(baseDoc) {
    DocumentSnapshot.check(baseDoc);
  }

  /**
   * Validates a `start` event. This is the event that kicks off the client.
   */
  _check_start() {
    // Nothing to do.
  }

  /**
   * Validates a `wantApplyDelta` event. This indicates that it is time to
   * send collected local changes up to the server.
   *
   * @param {DocumentSnapshot} baseDoc The document at the time of the original
   *   request.
   */
  _check_wantApplyDelta(baseDoc) {
    DocumentSnapshot.check(baseDoc);
  }

  /**
   * Validates a `wantChanges` event. This indicates that it is time to
   * request a new change from the server, but only if the client isn't in the
   * middle of doing something else.
   */
  _check_wantChanges() {
    // Nothing to do.
  }

  /**
   * In any state, handles event `apiError`. This is a "normal" occurrence if
   * the error has to do with the network connection (e.g. the network drops),
   * but is considered unusual (and error-worthy) if it happens for some other
   * reason.
   *
   * @param {string} method Name of the method that was called.
   * @param {ApiError} reason Error reason.
   */
  _handle_any_apiError(method, reason) {
    // Stop the user from trying to do more edits, as they'd get lost.
    this._quill.disable();

    if (reason.isConnectionError()) {
      // It's connection-related and probably no big deal.
      this._log.info(reason.message);
    } else {
      // It's something more dire; could be a bug on either side, for example.
      this._log.error(`Severe synch issue in \`${method}\``, reason);
    }

    // Note the time of the error, and determine if we've hit the point of
    // unrecoverability. If so, transition into the `unrecoverableError` state.
    // When this happens, higher-level logic can notice and take further action.
    this._addErrorStamp();
    if (this._isUnrecoverablyErrored()) {
      this._log.info('Too many errors!');
      this.s_unrecoverableError();
      return;
    }

    // Wait an appropriate amount of time and then try starting again. The
    // start event will be received in the `errorWait` state, and as such will
    // be handled differently than a clean start from scratch.

    (async () => {
      await Delay.resolve(RESTART_DELAY_MSEC);
      this.start();
    })();

    this.s_errorWait();
  }

  /**
   * In state `errorWait`, handles event `start`. This resets the internal
   * state and then issues a `start` event as if from the `detached` state.
   *
   * **TODO:** Ultimately this should be able to pick up the pieces of any
   * changes that were in-flight when the connection became problematic.
   */
  _handle_errorWait_start() {
    this._doc                        = null;
    this._sessionProxy               = null;
    this._currentEvent               = null;
    this._pendingDeltaAfter          = false;
    this._pendingLocalDocumentChange = false;

    // After this, it's just like starting from the `detached` state.
    this.s_detached();
    this.q_start();
  }

  /**
   * In state `errorWait`, handles most events.
   *
   * @param {string} name The event name.
   * @param {...*} args The event arguments.
   */
  _handle_errorWait_any(name, ...args) {
    // This space intentionally left blank (except for logging): We might get
    // "zombie" events from a connection that's shuffling towards doom. But even
    // if so, we will already have set up a timer to reset the connection.
    this._log.info('While in state `errorWait`:', name, args);
  }

  /**
   * In state `unrecoverableError`, handles all events. Specifically, this does
   * nothing, and no further events can be expected. Client code of this class
   * can use the transition into this state to perform higher-level error
   * recovery.
   *
   * @param {string} name The event name.
   * @param {...*} args The event arguments.
   */
  _handle_unrecoverableError_any(name, ...args) {
    this._log.info('While in state `unrecoverableError`:', name, args);
  }

  /**
   * In state `detached`, handles event `start`.
   *
   * This is the kickoff event.
   */
  async _handle_detached_start() {
    // **TODO:** This whole flow should probably be protected by a timeout.

    // Open (or reopen) the connection to the server. Even though the connection
    // won't become open synchronously, the API client code allows us to start
    // sending messages over it immediately. (They'll just get queued up as
    // necessary.)
    this._apiClient.open();

    // Perform a challenge-response to authorize access to the document.
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
    const snapshotPromise = sessionProxy.snapshot();

    try {
      const info = await infoPromise;
      this._log.info(`Session info: ${info}`);
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
    // and tell Quill about it.
    const firstEvent = this._quill.currentEvent;
    this._updateDocWithSnapshot(snapshot);

    // The above action should have caused the Quill instance to make a change
    // which shows up on its event chain. Grab it, and verify that indeed it's
    // the change we're expecting.
    const firstChange = firstEvent.nextOfNow(QuillEvent.TEXT_CHANGE);
    if (firstChange.source !== CLIENT_SOURCE) {
      // We expected the change to be the one we generated from the doc
      // update (above), but the `source` we got speaks otherwise.
      throw new Error('Shouldn\'t happen: Bad `source` for initial change.');
    }

    // With the Quill setup verified, remember the change as our local "head"
    // as the most recent change we've dealt with.
    this._currentEvent = firstChange;

    // And with that, it's now safe to enable Quill so that it will accept user
    // input.
    this._quill.enable();

    // Head into our first iteration of idling while waiting for changes coming
    // in locally (from quill) or from the server.
    this._becomeIdle();
  }

  /**
   * In most states, handles event `start`.
   */
  _handle_any_start() {
    // This space intentionally left blank: We are already active or in the
    // middle of starting, so there's nothing more to do.
  }

  /**
   * In state `idle`, handles event `wantChanges`. This can happen as a chained
   * event (during startup or at the end of handling the integration of changes)
   * or due to a delay timeout. This will make requests both to the server and
   * to the local Quill instance.
   */
  _handle_idle_wantChanges() {
    // We grab the current revision of the doc, so we can refer back to it when
    // a response comes. That is, `_doc` might have changed out from
    // under us between when this event is handled and when the promises used
    // here become resolved.
    const baseDoc = this._doc;

    // Ask Quill for any changes we haven't yet observed, via the document
    // change promise chain, but only if there isn't already a pending request
    // for same. (Otherwise, we would unnecessarily build up redundant promise
    // resolver functions when changes are coming in from the server while the
    // local user is idle.)
    if (!this._pendingLocalDocumentChange) {
      this._pendingLocalDocumentChange = true;

      // **Note:** As of this writing, Quill will never reject (report an error
      // on) a document change promise.
      (async () => {
        await this._currentEvent.next;
        this._pendingLocalDocumentChange = false;
        this.q_gotLocalDelta(baseDoc);
      })();
    }

    // Ask the server for any changes, but only if there isn't already a pending
    // request for same. (Otherwise, we would flood the server for new change
    // requests while the local user is updating the doc.)
    if (!this._pendingDeltaAfter) {
      this._pendingDeltaAfter = true;

      (async () => {
        try {
          const value = await this._sessionProxy.deltaAfter(baseDoc.revNum);
          this._pendingDeltaAfter = false;
          this.q_gotDeltaAfter(baseDoc, value);
        } catch (e) {
          this._pendingDeltaAfter = false;
          this.q_apiError('deltaAfter', e);
        }
      })();
    }
  }

  /**
   * In any state but `idle`, handles event `wantChanges`. We ignore the event,
   * because the client is in the middle of doing something else. When it's done
   * with whatever it may be, it will send a new `wantChanges` event.
   */
  _handle_any_wantChanges() {
    // Nothing to do. Stay in the same state.
  }

  /**
   * In state `idle`, handles event `gotDeltaAfter`.
   *
   * @param {DocumentSnapshot} baseDoc The document at the time of the original
   *   request.
   * @param {DocumentDelta} result How to transform `baseDoc` to get a later
   *   document revision.
   */
  _handle_idle_gotDeltaAfter(baseDoc, result) {
    this._log.detail(`Delta from server: ${result.revNum}`);

    // We only take action if the result's base (what `delta` is with regard to)
    // is the current `_doc`. If that _isn't_ the case, then what we have here
    // is a stale response of one sort or another. For example (and most
    // likely), it might be the delayed result from an earlier iteration.
    if (this._doc.revNum === baseDoc.revNum) {
      this._updateDocWithDelta(result);
    }

    // Fire off the next iteration of requesting server changes, after a short
    // delay. The delay is just to keep network traffic at a stately pace
    // despite any particularly active editing by other clients.
    (async () => {
      await Delay.resolve(PULL_DELAY_MSEC);
      this.q_wantChanges();
    })();
  }

  /**
   * In most states, handles event `gotDeltaAfter`. This will happen when a
   * server delta comes when we're in the middle of handling a local change. As
   * such, it is safe to ignore, because after the local change is integrated,
   * the system will fire off a new `deltaAfter()` request.
   *
   * @param {DocumentSnapshot} baseDoc_unused The document at the time of the
   *   original request.
   * @param {DocumentDelta} result_unused How to transform `baseDoc` to get a
   *   later document revision.
   */
  _handle_any_gotDeltaAfter(baseDoc_unused, result_unused) {
    // Nothing to do. Stay in the same state.
  }

  /**
   * In state `idle`, handles event `gotLocalDelta`. This means that the local
   * user has started making some changes. We prepare to collect the changes
   * for a short period of time before sending them up to the server.
   *
   * @param {DocumentSnapshot} baseDoc The document at the time of the original
   *   request.
   */
  _handle_idle_gotLocalDelta(baseDoc) {
    if (this._doc.revNum !== baseDoc.revNum) {
      // This state machine event was generated with respect to a revision of
      // the document which has since been updated, or we ended up having two
      // events for the same change (which can happen if the user is
      // particularly chatty) and this one lost the race. That is, this is from
      // a stale request for changes. Go back to idling.
      this._becomeIdle();
      return;
    }

    const event = this._currentEvent.nextNow;

    if (event.source === CLIENT_SOURCE) {
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

    switch (event.eventName) {
      case QuillEvent.TEXT_CHANGE: {
        // It's a document modification. Go into state `collecting`, leaving the
        // event chain alone for now. After the prescribed amount of time, the
        // `collecting` handler will hoover up the event with any other edits
        // that happened in the mean time.
        (async () => {
          await Delay.resolve(PUSH_DELAY_MSEC);
          this.q_wantApplyDelta(baseDoc);
        })();

        this.s_collecting();
        return;
      }

      case QuillEvent.SELECTION_CHANGE: {
        // Consume the event, and send it onward to the caret tracker, which
        // might ultimately inform the server about it. Then go back to idling.
        if (event.range) {
          this._docSession.caretTracker.update(this._doc.revNum, event.range);
        }
        this._currentEvent = event;
        this._becomeIdle();
        return;
      }

      default: {
        // As of this writing, there are no other Quill events, so it's weird
        // and unexpected if we land here.
        throw new Error(`Weird Quill event: ${event.eventName}`);
      }
    }
  }

  /**
   * In most states, handles event `gotLocalDelta`. This will happen when a
   * local delta comes in after we're already in the middle of handling a
   * chain of local changes. As such, it is safe to ignore, because whatever
   * the change was, it will get handled by that pre-existing process.
   *
   * @param {DocumentSnapshot} baseDoc_unused The document at the time of the
   *   original request.
   */
  _handle_any_gotLocalDelta(baseDoc_unused) {
    // Nothing to do. Stay in the same state.
  }

  /**
   * In state `collecting`, handles event `wantApplyDelta`. This means that it
   * is time for the collected local changes to be sent up to the server for
   * integration.
   *
   * @param {DocumentSnapshot} baseDoc The document at the time of the original
   *   request.
   */
  _handle_collecting_wantApplyDelta(baseDoc) {
    if (this._doc.revNum !== baseDoc.revNum) {
      // As with the `gotLocalDelta` event, we ignore this event if the doc has
      // changed out from under us.
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

    // Send the delta, and handle the response.
    (async () => {
      try {
        const value =
          await this._sessionProxy.applyDelta(this._doc.revNum, delta);
        this.q_gotApplyDelta(delta, value);
      } catch (e) {
        this.q_apiError('applyDelta', e);
      }
    })();

    this.s_merging();
  }

  /**
   * In state `merging`, handles event `gotApplyDelta`. This means that a local
   * change was successfully merged by the server.
   *
   * @param {FrozenDelta} delta The delta that was originally applied.
   * @param {DocumentDelta} correctedChange The correction to the expected
   *   result as returned from `applyDelta()`.
   */
  _handle_merging_gotApplyDelta(delta, correctedChange) {
    // These are the same variable names as used on the server side. See below
    // for more detail.
    const dCorrection = correctedChange.delta;
    const vResultNum  = correctedChange.revNum;

    this._log.detail(`Correction from server: r${vResultNum}`, dCorrection);

    if (dCorrection.isEmpty()) {
      // There is no change from what we expected. This means that no other
      // client got in front of us between when we received the current revision
      // and when we sent the delta to the server. And _that_ means it's safe to
      // update the client's revision of the current document and go back to
      // idling.
      //
      // In particular, if there happened to be any local changes made (coming
      // from Quill) while the server request was in flight, they will be picked
      // up promptly due to the handling of the `wantChanges` event which will
      // get fired off immediately.
      //
      // And note that Quill doesn't need to be updated here (that is, its delta
      // is empty) because what we are integrating into the client document is
      // exactly what Quill handed to us.
      this._updateDocWithDelta(
        new DocumentDelta(vResultNum, delta), FrozenDelta.EMPTY);
      this._becomeIdle();
      return;
    }

    // The server merged in some changes that we didn't expect.

    // This "corrected delta" consists of the original combined delta that we
    // got from Quill (that is, representing a delta from the client's current
    // state to Quill's current state) composed with the correction to that
    // delta which when applied brings the client's state into alignment with
    // the server's state.
    const correctedDelta = FrozenDelta.coerce(delta.compose(dCorrection));

    if (this._currentEvent.nextOfNow(QuillEvent.TEXT_CHANGE) === null) {
      // Thanfully, the local user hasn't made any other changes while we
      // were waiting for the server to get back to us, which means we can
      // cleanly apply the correction on top of Quill's current state.
      this._updateDocWithDelta(
        new DocumentDelta(vResultNum, correctedDelta), dCorrection);
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
    //    server. At this point, the local doc still doesn't know about
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
    const dIntegratedCorrection =
      FrozenDelta.coerce(dMore.transform(dCorrection, false));
    this._updateDocWithDelta(
      new DocumentDelta(vResultNum, correctedDelta), dIntegratedCorrection);

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
    // the user, and as such we _don't_ want to ignore the change.
    const nextNow = this._currentEvent.withNewPayload(QuillEvent.TEXT_CHANGE, {
      delta:     dNewMore,
      source:    'user'
    });

    // Make a new head of the change chain which points at the `nextNow` we
    // just constructed above. We don't include any payload since this class
    // never actually looks at the payload of `_currentEvent`.
    this._currentEvent = nextNow.withPushedHead();

    this._becomeIdle();
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
   * @returns {FrozenDelta} A combined delta of all the salient changes. This
   *   will be empty if there are no such changes (that is, if this class's
   *   document model is up-to-date with respect to Quill).
   */
  _consumeLocalChanges(includeOurChanges) {
    let delta = null;

    let change = this._currentEvent;
    for (;;) {
      const nextNow = change.nextOfNow(QuillEvent.TEXT_CHANGE);
      if (nextNow === null) {
        break;
      }

      change = nextNow;
      if (!(includeOurChanges || (change.source !== CLIENT_SOURCE))) {
        break;
      }

      delta = (delta === null) ? change.delta : delta.compose(change.delta);
    }

    // Remember that we consumed all these changes.
    this._currentEvent = change;

    return FrozenDelta.coerce(delta);
  }

  /**
   * Updates `_doc` to be the given revision by applying the indicated delta
   * to the current revision, and tells the attached Quill instance to update
   * itself accordingly.
   *
   * This is only valid to call when the revision of the document that Quill has
   * is the same as what is represented in `_doc` _or_ if `quillDelta` is passed
   * as an empty delta. That is, this is only valid when Quill's revision of the
   * document doesn't need to be updated. If that isn't the case, then this
   * method will throw an error.
   *
   * @param {DocumentDelta} delta Delta from the current `_doc` contents.
   * @param {FrozenDelta} [quillDelta = delta] Delta from Quill's current state,
   *   which is expected to preserve any state that Quill has that isn't yet
   *   represented in `_doc`. This must be used in cases where Quill's state has
   *   progressed ahead of `_doc` due to local activity.
   */
  _updateDocWithDelta(delta, quillDelta = delta.delta) {
    const needQuillUpdate = !quillDelta.isEmpty();

    if (   (this._currentEvent.nextOfNow(QuillEvent.TEXT_CHANGE) !== null)
        && needQuillUpdate) {
      // It is unsafe to apply the delta as-is, because we know that Quill's
      // revision of the document has diverged.
      throw new Error('Cannot apply delta due to revision skew.');
    }

    // Update the local document.
    this._doc = this._doc.compose(delta);

    // Tell Quill if necessary.
    if (needQuillUpdate) {
      this._quill.updateContents(quillDelta, CLIENT_SOURCE);
    }
  }

  /**
   * Updates `_doc` to be the given snapshot, and tells the attached Quill
   * instance to update itself accordingly.
   *
   * @param {DocumentSnapshot} snapshot New snapshot.
   */
  _updateDocWithSnapshot(snapshot) {
    this._doc = snapshot;
    this._quill.setContents(snapshot.contents, CLIENT_SOURCE);
  }

  /**
   * Sets up the state machine to idle while waiting for changes.
   */
  _becomeIdle() {
    this.s_idle();
    this.q_wantChanges();
  }

  /**
   * Trim the error timestamp list of any errors that have "aged out," and add
   * a new one for the current moment in time.
   */
  _addErrorStamp() {
    const now = Date.now();
    const agedOut = now - ERROR_WINDOW_MSEC;

    this._errorStamps = this._errorStamps.filter(value => (value >= agedOut));
    this._errorStamps.push(now);
  }

  /**
   * Determine whether the current set of error timestamps means that the
   * instance is unrecoverably errored.
   *
   * @returns {boolean} `true` iff the instance is unrecoverably errored.
   */
  _isUnrecoverablyErrored() {
    const errorCount      = this._errorStamps.length;
    const errorsPerMinute = (errorCount / ERROR_WINDOW_MSEC) * 60 * 1000;

    this._log.info(
      `Error window: ${errorCount} total; ` +
      `${Math.round(errorsPerMinute * 100) / 100} per minute`);

    return errorsPerMinute >= ERROR_MAX_PER_MINUTE;
  }
}
