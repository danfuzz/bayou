// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Delta from 'quill-delta';

import DeltaUtil from 'delta-util';
import PromDelay from 'prom-delay';
import SeeAll from 'see-all';

import ApiError from './ApiError';

/** Logger. */
const log = new SeeAll('doc');

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
const PLUMBING_SOURCE = 'document-plumbing';

/**
 * Constructors for the events used by the client synching state machine.
 *
 * **Note:** This class serves as documentation for each of the kinds of events
 * used by the system.
 */
class Events {
  /**
   * Constructs an `apiError` event. This indicates that an error was reported
   * back from an API call.
   *
   * @param method Name of the method that was called.
   * @param reason Error reason.
   * @returns The constructed event.
   */
  static apiError(method, reason) {
    return {name: 'apiError', method: method, reason: reason};
  }

  /**
   * Constructs a `gotApplyDelta` event. This represents a successful result
   * from the API call `applyDelta()`. Keys are as defined by that API, with
   * the addition of `expectedData` which represents the expected result of
   * merge (which will be the case if there are no other intervening changes).
   *
   * @param expectedData The expected result of the merge. This will be the
   *   actual result if there are no other intervening changes (indicated by the
   *   fact that `delta` is empty).
   * @param version The version number of the resulting document.
   * @param delta The delta from `expectedData`.
   * @returns The constructed event.
   */
  static gotApplyDelta(expectedData, version, delta) {
    return {
      name:         'gotApplyDelta',
      expectedData: expectedData,
      version:      version,
      delta:        delta
    };
  }

  /**
   * Constructs a `gotDeltaAfter` event. This represents a successful result
   * from the API call `deltaAfter()`. Keys are as defined by that API, with
   * the addition of `baseDoc` which represents the document at the time of the
   * request.
   *
   * @param baseDoc The document (version and data) at the time of the original
   *   request.
   * @param version The version number of the document.
   * @param delta The delta from `baseDoc`.
   * @returns The constructed event.
   */
  static gotDeltaAfter(baseDoc, version, delta) {
    return {name: 'gotDeltaAfter', baseDoc: baseDoc, version: version, delta: delta};
  }

  /**
   * Constructs a `gotLocalDelta` event. This indicates that there is at least
   * one local change that Quill has made to its document which is not yet
   * reflected in the given base document. Put another way, this indicates that
   * `_latestTextChange` has a resolved `next`.
   *
   * @param baseDoc The document (version and data) at the time of the original
   *   request.
   * @returns The constructed event.
   */
  static gotLocalDelta(baseDoc) {
    return {name: 'gotLocalDelta', baseDoc: baseDoc};
  }

  /**
   * Constructs a `gotSnapshot` event. This represents a successful result from
   * the API call `snapshot()`. Keys are as defined by that API.
   *
   * @param version The version number of the document.
   * @param data The document data.
   * @returns The constructed event.
   */
  static gotSnapshot(version, data) {
    return {name: 'gotSnapshot', version: version, data: data};
  }

  /**
   * Constructs a `start` event. This is the event that kicks off the client.
   *
   * @returns The constructed event.
   */
  static start() {
    return {name: 'start'};
  }

  /**
   * Constructs a `wantApplyDelta` event. This indicates that it is time to
   * send collected local changes up to the server.
   *
   * @param baseDoc The document (version and data) at the time of the original
   *   request.
   * @returns The constructed event.
   */
  static wantApplyDelta(baseDoc) {
    return {name: 'wantApplyDelta', baseDoc: baseDoc};
  }

  /**
   * Constructs a `wantChanges` event. This indicates that it is time to
   * request a new change from the server, but only if the client isn't in the
   * middle of doing something else.
   *
   * @returns The constructed event.
   */
  static wantChanges() {
    return {name: 'wantChanges'};
  }
}

/**
 * Event response to use when transitioning into the `idle` state, when there
 * is no other pending work.
 */
const IDLE_EVENT_TRANSITION = {state: 'idle', event: Events.wantChanges()};

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
export default class DocumentPlumbing {
  /**
   * Constructs an instance. It is initially in state `detached`. The
   * constructed instance expects to be the primary non-human controller of the
   * Quill instance it manages.
   *
   * @param `quill` Quill editor instance.
   * @param `api` `ApiClient` instance.
   */
  constructor(quill, api) {
    /** Editor object. */
    this._quill = quill;

    /** API interface. */
    this._api = api;

    /** Current state. */
    this._state = 'detached';

    /**
     * Latest version of the document as received from the server. An object
     * that binds `version` (version number) and `data` (a from-empty `Delta`).
     * Becomes non-null once the first snapshot is received from the server.
     */
    this._doc = null;

    /**
     * Latest local change to the document made by Quill. This is initialized
     * by getting `Quill.nextTextChange` and is generally updated by
     * retrieving `.nextNow` from the value (or its replacement, etc.).
     */
    this._latestTextChange = null;

    /**
     * Is there currently a pending (as-yet unfulfilled) `deltaAfter()` request
     * to the server?
     */
    this._pendingDeltaAfter = false;

    /**
     * Is there currently a pending (as-yet unfulfilled) request for a new
     * local change via the Quill text change promise chain?
     */
    this._pendingLocalTextChange = false;

    /** Count of events handled. Used for logging. */
    this._eventCount = 0;

    // The Quill instance should already be in read-only mode. We explicitly
    // set that here, though, to be safe and resilient.
    quill.disable();
  }

  /**
   * Requests that this instance start interacting with its associated editor
   * and API handler.
   */
  start() {
    this._event(Events.start());
  }

  /**
   * Informs this instance that the given event has been received.
   *
   * @param event The event that was received.
   */
  _event(event) {
    log.detail(`In state: ${this._state}`);

    // Event handlers optionally return an event to immediately dispatch. The
    // loop here terminates when the handler chooses _not_ to do such an event
    // dispatch chaining.
    do {
      // Log the event details (if not squelched) and occasional count.
      log.detail('Event:', event);
      this._eventCount++;
      if ((this._eventCount % 25) === 0) {
        log.info(`Handled ${this._eventCount} events.`);
      }

      // Dispatch the event: Construct the method name to dispatch to based on
      // the current state and event name. Fetch the method. If it isn't
      // defined, look for a default handler for the event. If _that_ isn't
      // defined, use the error handler method.

      const eventName = event.name;
      const handlerName = `_handle_${this._state}_${eventName}`;
      const method = this[`_handle_${this._state}_${eventName}`]
        || this[`_handle_default_${eventName}`]
        || this._handle_error;

      // Call the handler. Remember the new state, and iterate if the handler
      // gave us a new event to dispatch.

      const result = method.call(this, event);

      if (!result || !result.state) {
        // Shouldn't happen. Indicates a bug in this code.
        log.wtf(`Bogus result from ${eventName} handler for state ${this._state}.`,
          event, result);
      }

      if ((result.state !== 'same') && (result.state !== this._state)) {
        log.detail(`New state: ${result.state}`);
        this._state = result.state;
      }

      event = result.event;
    } while (event);

    log.detail(`Done.`);
  }

  /**
   * Error handler. This is called when an event is received in a state that
   * is not defined to handle that state.
   */
  _handle_error(event) {
    // TODO: Probably something more sensible.
    throw new Error(`Cannot handle event ${event.name} in state ${this._state}.`);
  }

  /**
   * In any state, handles event `apiError`. This is a "normal" occurrence if
   * the error has to do with the network connection (e.g. the network drops),
   * but is considered unusual (and error-worthy) if it happens for some other
   * reason.
   */
  _handle_default_apiError(event) {
    const method = event.method;
    const reason = event.reason;

    if (reason.layer === ApiError.CONN) {
      // It's connection-related and probably no big deal.
      log.info(`${reason.code}: ${reason.desc}`)
    } else {
      // It's something more dire; could be a bug on either side, for example.
      log.error(`Severe synch issue ${reason.code}: ${reason.desc}`);
    }

    // Wait an appropriate amount of time and then try starting again. The
    // start event will be received in the `errorWait` state, and as such will
    // be handled differently than a clean start from scratch.
    PromDelay.resolve(RESTART_DELAY_MSEC).then((res) => {
      this.start();
    });

    return {state: 'errorWait'};
  }

  /**
   * In state `errorWait`, handles event `start`.
   *
   * This is the kickoff event.
   */
  _handle_errorWait_start(event) {
    // Reset the document state. TODO: Ultimately this should be able to
    // pick up the pieces of any changes that were in-flight when the connection
    // became problematic.
    this._doc = null;
    this._latestTextChange = null;
    this._pendingDeltaAfter = false;
    this._pendingLocalTextChange = false;

    // Reopen the connection to the server.
    this._api.open();

    // After this, it's just like starting from the `detached` state.
    return {state: 'detached', event};
  }

  /**
   * In state `detached`, handles event `start`.
   *
   * This is the kickoff event.
   */
  _handle_detached_start(event) {
    // TODO: This should probably arrange for a timeout.
    this._api.snapshot().then(
      (value) => {
        this._event(Events.gotSnapshot(value.version, value.data));
      },
      (error) => {
        this._event(Events.apiError('snapshot', error));
      });

    return {state: 'starting'};
  }

  /**
   * In state `starting`, handles event `gotSnapshot`.
   */
  _handle_starting_gotSnapshot(event) {
    // Save the result as the latest known version of the document, and tell
    // Quill about it.
    this._updateDocWithSnapshot(event.version, event.data);

    // The above action should have caused the Quill instance to make a change
    // which shows up on its change chain. Grab it, and verify that indeed it's
    // the change we're expecting.
    const firstChange = this._quill.latestTextChange;
    if (firstChange.source !== PLUMBING_SOURCE) {
      // We expected the change to be the one we generated from the doc
      // update (above), but the `source` we got speaks otherwise.
      throw new Error('Shouldn\'t happen: Bad `source` for initial change.');
    }

    // With the Quill setup verified, remember the change as our local "head"
    // as the most recent change we've dealt with.
    this._latestTextChange = firstChange;

    // And with that, it's now safe to enable Quill so that it will accept user
    // input.
    this._quill.enable();

    // Head into our first iteration of idling while waiting for changes coming
    // in locally (from quill) or from the server.
    return IDLE_EVENT_TRANSITION;
  }

  /**
   * In state `idle`, handles event `wantChanges`. This can happen as a chained
   * event (during startup or at the end of handling the integration of changes)
   * or due to a delay timeout. This will make requests both to the server and
   * to the local Quill instance.
   */
  _handle_idle_wantChanges(event) {
    // We grab the current version of the doc, so we can refer back to it when
    // a response comes. That is, `_doc` might have changed out from
    // under us between when this event is handled and when the promises used
    // here become resolved.
    const baseDoc = this._doc;

    // Ask Quill for any changes we haven't yet observed, via the text change
    // promise chain, but only if there isn't already a pending request for
    // same. (Otherwise, we would unnecessarily build up redundant promise
    // resolver functions when changes are coming in from the server while the
    // local user is idle.)
    if (!this._pendingLocalTextChange) {
      this._pendingLocalTextChange = true;

      // **Note:** As of this writing, Quill will never reject (report an error
      // on) a text change promise.
      this._latestTextChange.next.then(
        (value) => {
          this._pendingLocalTextChange = false;
          this._event(Events.gotLocalDelta(baseDoc));
        }
      );
    }

    // Ask the server for any changes, but only if there isn't already a pending
    // request for same. (Otherwise, we would flood the server for new change
    // requests while the local user is updating the doc.)
    if (!this._pendingDeltaAfter) {
      this._pendingDeltaAfter = true;

      this._api.deltaAfter(baseDoc.version).then(
        (value) => {
          this._pendingDeltaAfter = false;
          this._event(Events.gotDeltaAfter(baseDoc, value.version, value.delta));
        },
        (error) => {
          this._pendingDeltaAfter = false;
          this._event(Events.apiError('deltaAfter', error));
        });
    }

    return {state: 'idle'};
  }

  /**
   * In any state but `idle`, handles event `wantChanges`. We ignore the event,
   * because the client is in the middle of doing something else. When it's done
   * with whatever it may be, it will send a new `wantChanges` event.
   */
  _handle_default_wantChanges(event) {
    // Nothing to do. Stay in the same state.
    return {state: 'same'};
  }

  /**
   * In state `idle`, handles event `gotDeltaAfter`.
   */
  _handle_idle_gotDeltaAfter(event) {
    const baseDoc = event.baseDoc;
    const version = event.version;
    const delta = event.delta;

    log.detail(`Delta from server: v${version}`, delta);

    // We only take action if the result's base (what `delta` is with regard to)
    // is the current `_doc`. If that _isn't_ the case, then what we have here
    // is a stale response of one sort or another. For example (and most
    // likely), it might be the delayed result from an earlier iteration.
    if (this._doc.version === baseDoc.version) {
      this._updateDocWithDelta(version, delta);
    }

    // Fire off the next iteration of requesting server changes. We do this via
    // a `PromDelay` for two reasons: (1) We want to pace requests at least a
    // bit. (2) We want to avoid any potential memory leaks due to promise
    // causality chaining.
    PromDelay.resolve(PULL_DELAY_MSEC).then((res) => {
      this._event(Events.wantChanges());
    });

    return {state: 'idle'};
  }

  /**
   * In most states, handles event `gotDeltaAfter`. This will happen when a
   * server delta comes when we're in the middle of handling a local change. As
   * such, it is safe to ignore, because after the local change is integrated,
   * the system will fire off a new `deltaAfter()` request.
   */
  _handle_default_gotDeltaAfter(event) {
    return {state: 'same'};
  }

  /**
   * In state `idle`, handles event `gotLocalDelta`. This means that the local
   * user has started making some changes. We prepare to collect the changes
   * for a short period of time before sending them up to the server.
   */
  _handle_idle_gotLocalDelta(event) {
    const baseDoc = event.baseDoc;
    const change = this._latestTextChange.nextNow;

    if ((this._doc.version !== baseDoc.version) || (change === null)) {
      // The event was generated with respect to a version of the document which
      // has since been updated, or we ended up having two events for the same
      // change (which can happen if the user is particularly chatty) and this
      // one lost the race. That is, this is from a stale request for changes.
      // Go back to idling.
      return IDLE_EVENT_TRANSITION;
    } else if (change.source === PLUMBING_SOURCE) {
      // This event was generated by Quill because of action taken by this
      // class. We don't want to collect it, lest we end up in a crazy feedback
      // loop. Since we're in state `idle`, there aren't any other pending
      // changes to worry about, so we just ignore the change (skip it in the
      // chain) and go back to idling.
      this._latestTextChange = change;
      return IDLE_EVENT_TRANSITION;
    }

    // After the appropriate delay, send a `wantApplyDelta` event.
    PromDelay.resolve(PUSH_DELAY_MSEC).then((res) => {
      this._event(Events.wantApplyDelta(baseDoc));
    });

    return {state: 'collecting'};
  }

  /**
   * In most states, handles event `gotLocalDelta`. This will happen when a
   * local delta comes in after we're already in the middle of handling a
   * chain of local changes. As such, it is safe to ignore, because whatever
   * the change was, it will get handled by that pre-existing process.
   */
  _handle_default_gotLocalDelta(event) {
    return {state: 'same'};
  }

  /**
   * In state `collecting`, handles event `wantApplyDelta`. This means that it
   * is time for the collected local changes to be sent up to the server for
   * integration.
   */
  _handle_collecting_wantApplyDelta(event) {
    const baseDoc = event.baseDoc;

    if (this._doc.version !== baseDoc.version) {
      // As with the `gotLocalDelta` event, we ignore this event if the doc has
      // changed out from under us.
      return IDLE_EVENT_TRANSITION;
    }

    // Build up a combined (composed) delta of all of the changes starting just
    // after the last integrated change (the last change that was sent to the
    // server) through the latest change. This _excludes_ internally-sourced
    // changes, because we will handle those on the next iteration (from the
    // idle state).
    const delta = this._consumeLocalChanges();

    if (DeltaUtil.isEmpty(delta)) {
      // There weren't actually any net changes. This is unusual, though
      // possible. In particular, the user probably typed something and then
      // undid it.
      return IDLE_EVENT_TRANSITION;
    }

    // Construct the document (from-empty Delta) that we expect to be the result
    // of applying the pending change. In fact, we might end up with something
    // else from the server, but if so it is going to be represented as a delta
    // from what we've built here.
    const expectedData = this._doc.data.compose(delta);

    // Send the delta, and handle the response.
    this._api.applyDelta(this._doc.version, delta).then(
      (value) => {
        this._event(Events.gotApplyDelta(expectedData, value.version, value.delta));
      },
      (error) => {
        this._event(Events.apiError('applyDelta', error));
      });

    return {state: 'merging'};
  }

  /**
   * In state `merging`, handles event `gotApplyDelta`. This means that a local
   * change was successfully merged by the server.
   */
  _handle_merging_gotApplyDelta(event) {
    // These variable names correspond to the terminology used on the server
    // side. See `Document.js`.
    const vExpected = event.expectedData;
    const dCorrection = DeltaUtil.coerce(event.delta);
    const version = event.version;

    log.detail(`Correction from server: v${version}`, dCorrection);

    if (DeltaUtil.isEmpty(dCorrection)) {
      // There is no change from what we expected. This means that no other
      // client got in front of us between when we received the current version
      // and when we sent the delta to the server. That means it's safe to set
      // the current document and go back to idling.
      //
      // In particular, if there happened to be any local changes made (coming
      // from Quill) while the server request was in flight, they will be picked
      // up promptly due to the handling of the `wantChanges` event which will
      // get fired off immediately.
      this._updateDocWithSnapshot(version, vExpected, false);
      return IDLE_EVENT_TRANSITION;
    }

    // The server merged in some changes that we didn't expect.

    if (this._latestTextChange.nextNow === null) {
      // Thanfully, the local user hasn't made any other changes while we
      // were waiting for the server to get back to us. We need to tell
      // Quill about the changes, but we don't have to do additional merging.
      this._updateDocWithDelta(version, dCorrection);
      return IDLE_EVENT_TRANSITION;
    }

    // The hard case, a/k/a "Several people are typing." The server got back
    // to us with a response that included changes we didn't know about,
    // *and* in the mean time the local user has been busy making changes of
    // their own. We need to "transform" (in OT terms) or "rebase" (in git
    // terms) the local changes to be on top of the new base document as
    // provided by the server.
    //
    // Using the same terminology as used on the server side (see
    // `server/Document.js`), we start with `vExpected` (the document we
    // would have had if the server hadn't included extra changes) and
    // `dCorrection` (the delta given back to us from the server which can
    // be applied to `vExpected` to get the _actual_ next version). From
    // that, here's what we do:
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
    //    "synthetic" value for `_latestTextChange.nextNow`, and hook it up
    //    so that it will get noticed once we go back into the `idle` state.

    // (1)
    const dMore = this._consumeLocalChanges(true);

    // (2)

    // `false` indicates that `dMore` should be taken to have been applied
    // second (lost any insert races or similar).
    const dIntegratedCorrection = dMore.transform(dCorrection, false);
    this._updateDocWithDelta(version, dCorrection, dIntegratedCorrection);

    // (3)

    // The `true` argument indicates that `dCorrection` should be taken to
    // have been applied first (won any insert races or similar). **Note:**
    // `dNewMore` and `dIntegratedCorrection` (above) are approximately
    // "complements" of each other.
    const dNewMore = dCorrection.transform(dMore, true);

    // This is the synthetic text change which substitutes for the changes
    // that we consumed to construct `dMore` above. We use `user` for the
    // source and not `PLUMBING_SOURCE` because, even though we are in fact
    // making this change here (per se), the changes notionally came from
    // the user, and as such we _don't_ want to ignore the change.
    const nextNow = {
      delta:   dNewMore,
      source:  'user',
      next:    this._latestTextChange.next,
      nextNow: null
    };

    // This hooks up `nextNow.nextNow` to become non-null when the original
    // `_latestTextChange.nextNow` resolves. This maintains the invariant
    // that we rely on elsewhere (and which is provided under normal
    // circumstances by `QuillProm`), specifically that `change.nextNow`
    // becomes non-null as soon as `change.next` resolves to a value.
    nextNow.next.then((value) => { nextNow.nextNow = value; });

    // Make a new head of the change chain which points at the `nextNow` we
    // just constructed above.
    this._latestTextChange = {
      nextNow: nextNow,
      next:    Promise.resolve(nextNow)
    };

    return IDLE_EVENT_TRANSITION;
  }

  /**
   * Gets a combined (composed) delta of all text changes that have been made
   * to the Quill instance since the last time changes were integrated into
   * the server version of the document, optionally stopping at (and not
   * including) changes whose source is `PLUMBING_SOURCE` (that is, this class).
   * Updates `_latestTextChange` to indicate that all of these changes have in
   * fact been consumed.
   *
   * @param includeOurChanges If `true` indicates that changes with source
   *   `PLUMBING_SOURCE` _should_ be included.
   * @returns A combined delta of all the salient changes. This will be empty
   *   if there are no such changes (that is, if this class's document model
   *   is up-to-date with respect to Quill).
   */
  _consumeLocalChanges(includeOurChanges = false) {
    let delta = null;

    let change = this._latestTextChange;
    while (change.nextNow !== null) {
      change = change.nextNow;
      if (!(includeOurChanges || (change.source !== PLUMBING_SOURCE))) {
        break;
      }

      delta = (delta === null) ? change.delta : delta.compose(change.delta);
    }

    // Remember that we consumed all these changes.
    this._latestTextChange = change;

    return DeltaUtil.coerce(delta);
  }

  /**
   * Updates `_doc` to have the given version by applying the indicated delta
   * to the current version, and tells the attached Quill instance to update
   * itself accordingly. This is only valid to call when the version of the
   * document that Quill has is the same as what is represented in `_doc`. If
   * that isn't the case, then this method will throw an error.
   *
   * @param version New version number.
   * @param delta Delta from the current `_doc` data; can be a `Delta` object
   *   per se or anything that `DeltaUtil.coerce()` accepts.
   * @param quillDelta (optional) Delta from Quill's current state, which is
   *   expected to preserve any state that Quill has that isn't yet represented
   *   in `_doc`. This must be used in cases where Quill's state has progressed
   *   ahead of `_doc` due to local activity. This defaults to `delta`.
   */
  _updateDocWithDelta(version, delta, quillDelta = delta) {
    if (this._latestTextChange.nextNow !== null) {
      // It is unsafe to apply the delta as-is, because we know that Quill's
      // version of the document has diverged.
      throw new Error('Cannot apply delta due to version skew.');
    }

    // Update the local document. **Note:** We always construct a whole new
    // object even when the delta is empty, so that `_doc === x` won't cause
    // surprising results when `x` is an old version of `_doc`.
    const oldData = this._doc.data;
    this._doc = {
      version: version,
      data: DeltaUtil.isEmpty(delta) ? oldData : oldData.compose(delta)
    };

    // Tell Quill.
    this._quill.updateContents(quillDelta, PLUMBING_SOURCE);
  }

  /**
   * Updates `_doc` to have the given version and snapshot data, and optionally
   * tells the attached Quill instance to update itself accordingly.
   *
   * @param version New version number.
   * @param data New snapshot data; can be a `Delta` object per se or anything
   * that `DeltaUtil.coerce()` accepts.
   * @param updateQuill (default `true`) whether to inform Quill of this
   * update. This should only ever be passed as `false` when Quill is expected
   * to already have the changes to the document represented in `data`. (It
   * might _also_ have additional changes too.)
   */
  _updateDocWithSnapshot(version, data, updateQuill = true) {
    data = DeltaUtil.coerce(data);

    this._doc = {
      version: version,
      data: data
    }

    if (updateQuill) {
      this._quill.setContents(data, PLUMBING_SOURCE);
    }
  }
}
