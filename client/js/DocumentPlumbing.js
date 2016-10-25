// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Delta from 'quill-delta';

import Delay from './Delay';

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
 * Tag used to identify this module as the source of a Quill event or action.
 */
const QUILL_SOURCE = 'document-plumbing';

/**
 * Tag used specifically for internally-generated `gotLocalDelta` events, to
 * disambiguate them from events coming from Quill.
 */
const INTERNAL_SOURCE = 'document-plumbing-internal';

/**
 * Quill `Delta` helper utilities.
 */
class DeltaUtil {
  /**
   * Returns `true` iff the given delta is empty. This accepts raw arrays,
   * `Delta` objects per se, as well as `null` (which is considered to be
   * empty, unsurprisingly).
   *
   * @param delta (null-ok) The delta
   * @returns `true` if `delta` is empty or `false` if not
   */
  static isEmpty(delta) {
    if (delta === null) {
      return true;
    } else if (delta.ops) {
      return (delta.ops.length === 0);
    } else {
      return delta.length === 0;
    }
  }
}

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
   * @param error Error message.
   * @returns The constructed event.
   */
  static apiError(method, message) {
    return { name: 'apiError', method: method, message: message };
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
    return { name: 'gotApplyDelta', expectedData: expectedData, version: version, delta: delta };
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
    return { name: 'gotDeltaAfter', baseDoc: baseDoc, version: version, delta: delta };
  }

  /**
   * Constructs a `gotLocalDelta` event. This represents a local change that
   * was made to the document. Keys are as defined by the definition of the
   * Quill `text-change` event. In the case where the `source` is
   * `INTERNAL_SOURCE`, it means that the event was generated from inside the
   * state machine; this can happen when doing a non-trivial merge of server
   * and local changes.
   *
   * @param delta The change that was made locally.
   * @param oldContents The state of the document before the change.
   * @param source Identifier for the source of the change.
   * @returns The constructed event.
   */
  static gotLocalDelta(delta, oldContents, source) {
    return { name: 'gotLocalDelta', delta: delta, oldContents: oldContents, source: source };
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
    return { name: 'gotSnapshot', version: version, data: data };
  }

  /**
   * Constructs a `start` event. This is the event that kicks off the client.
   *
   * @returns The constructed event.
   */
  static start() {
    return { name: 'start' };
  }

  /**
   * Constructs a `wantApplyDelta` event. This indicates that it is time to
   * send collected local changes up to the server.
   *
   * @returns The constructed event.
   */
  static wantApplyDelta() {
    return { name: 'wantApplyDelta' };
  }

  /**
   * Constructs a `wantDeltaAfter` event. This indicates that it is time to
   * request a new change from the server, but only if the client isn't in the
   * middle of doing something else.
   *
   * @returns The constructed event.
   */
  static wantDeltaAfter() {
    return { name: 'wantDeltaAfter' };
  }
}

/**
 * Event response to use when transitioning into the `idle` state, when there
 * is no other pending work.
 */
const IDLE_EVENT_TRANSITION = { state: 'idle', event: Events.wantDeltaAfter() };

/**
 * Plumbing between Quill on the client and the document model on the server.
 * It is structured as a state machine, which maintains a current named state
 * along with a few other bits of information, and takes action upon receipt of
 * structured events, some of which it produces itself either immediately in
 * response to received events or after an explicit time delay.
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
     * Collected delta. This represents a change to the document which is
     * ultimately going to be sent to the server.
     */
    this._collectedDelta = null;

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
    // Event handlers optionally return an event to immediately dispatch. The
    // loop here terminates when the handler chooses _not_ to do such an event
    // dispatch chaining.
    do {
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
        throw new Error(`Bogus result from ${eventName} handler for state ${this._state}.`);
      }

      if (result.state !== 'same') {
        this._state = result.state;
      }

      event = result.event;
    } while (event);
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
   * In any state, handles event `apiError`.
   */
  _handle_default_apiError(event) {
    // TODO: Probably something more sensible.
    throw new Error(`Trouble from API method \`${event.method}\`: ${event.message}`);
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

    return { state: 'starting' };
  }

  /**
   * In state `starting`, handles event `gotSnapshot`.
   */
  _handle_starting_gotSnapshot(event) {
    // Save the result as the latest known version of the document, and tell
    // Quill about it.
    this._updateDoc(event.version, new Delta(event.data));

    // Once we have initial contents, we can usefully handle changes coming
    // from Quill. So, we attach an event handler and tell Quill to start
    // accepting user input. (Before this, Quill shouldn't have been sending
    // any events anyway, but adding the event handler here is a more
    // prophylactic arrangement.)

    this._quill.on('text-change', (delta, oldContents, source) => {
      if (source === QUILL_SOURCE) {
        // This event was generated by Quill because of action taken by this
        // class. Ignore it, lest we end up in a crazy feedback loop.
        return;
      }

      // Translate the Quill event into a state machine event.
      this._event(Events.gotLocalDelta(delta, oldContents, source));
    });
    this._quill.enable();

    // Fire off the first request for changes coming from the server side, via
    // a chained event.
    return IDLE_EVENT_TRANSITION;
  }

  /**
   * In state `idle`, handles event `wantDeltaAfter`. This can happen as a
   * chained event (during startup or at the end of handling the integration of
   * changes) or due to a delay timeout.
   */
  _handle_idle_wantDeltaAfter(event) {
    // We grab the current version of the doc, so we can refer back to it when
    // the response comes. That is, `_doc` might have changed out from under us
    // between when this event is handled and when the call to `deltaAfter()`
    // becomes resolved.
    const baseDoc = this._doc;

    this._api.deltaAfter(baseDoc.version).then(
      (value) => {
        this._event(Events.gotDeltaAfter(baseDoc, value.version, value.delta));
      },
      (error) => {
        this._event(Events.apiError('deltaAfter', error));
      });

    return { state: 'idle' };
  }

  /**
   * In any state but `idle`, handles event `wantDeltaAfter`. We ignore the
   * event, because the client is in the middle of doing something else. When
   * it's done with whatever it may be, it will send a new `wantDeltaAfter`
   * event.
   */
  _handle_default_wantDeltaAfter(event) {
    // Nothing to do. Stay in the same state.
    return { state: 'same' };
  }

  /**
   * In state `idle`, handles event `gotDeltaAfter`.
   */
  _handle_idle_gotDeltaAfter(event) {
    const baseDoc = event.baseDoc;
    const version = event.version;
    const delta = event.delta;
    console.log('Delta from server');
    console.log(version);
    console.log(delta);

    // We only take action if the result version is newer than what we
    // have as the latest. That is, we might have what amounts to a stale
    // response which should be ignored. In particular, `_doc` can change
    // because of action related to local changes.
    if (version > this._doc.version) {
      // Build the new doc based on the base version and the received delta.
      // TODO: Quill tends to reset the cursor when you just hand it entirely
      // new contents. This should instead try to give Quill just the delta from
      // its current state. The wrinkle here is that we need to be sure we
      // don't inadvertently write over any user changes. (Given that the JS
      // runtime is single-threaded, this might not turn out to be very hard to
      // get right.)
      const newData = baseDoc.data.compose(delta);
      this._updateDoc(version, newData);
    }

    // Fire off the next iteration of requesting server changes. We do this via
    // a `Delay` for two reasons: (1) We want to pace requests at least a bit.
    // (2) We want to avoid any potential memory leaks due to promise causality
    // chaining.
    Delay.resolve(PULL_DELAY_MSEC).then((res) => {
      this._event(Events.wantDeltaAfter());
    });

    return { state: 'idle' };
  }

  /**
   * In state `idle`, handles event `gotLocalDelta`. This means that the local
   * user has started making some changes. We prepare to collect the changes
   * for a short period of time before sending them up to the server.
   */
  _handle_idle_gotLocalDelta(event) {
    const delta = event.delta;
    const oldContents = event.oldContents;
    const source = event.source;

    // Initialize the collected delta with the one we just got.
    this._collectedDelta = delta;

    // After the appropriate delay, send a `wantApplyDelta` event, which will
    // cause all the collected changes to be sent to the server.
    Delay.resolve(PUSH_DELAY_MSEC).then((res) => {
      this._event(Events.wantApplyDelta());
    });

    return { state: 'collecting' };
  }

  /**
   * In state `collecting`, handles event `gotLocalDelta`.
   */
  _handle_collecting_gotLocalDelta(event) {
    // Combine the new delta with the previous results of collection.
    this._collectedDelta = this._collectedDelta.compose(event.delta);

    return { state: 'collecting' };
  }

  /**
   * In state `collecting`, handles event `wantApplyDelta`. This means that it
   * is time for the collected local changes to be sent up to the server for
   * integration.
   */
  _handle_collecting_wantApplyDelta(event) {
    const delta = this._collectedDelta;

    if (DeltaUtil.isEmpty(delta)) {
      // There weren't actually any changes. This is unusual, though possible:
      // * The user might have typed something and then undone it.
      // * We might be in this call because of the delayed event from the
      //   `gotLocalDelta` handler for the `idle` state, but an earlier event
      //   might have precipitated handling of the collected delta.
      return IDLE_EVENT_TRANSITION;
    }

    // Construct the document (from-empty Delta) that we expect to be the result
    // of applying the pending change. In fact, we might end up with something
    // else from the server, but if so it is going to be represented as a delta
    // from what we've built here.
    const expectedData = this._doc.data.compose(delta);

    // Reset the queue, so we can start collecting more changes afresh.
    this._collectedDelta = null;

    // Send the delta, and handle the response.
    this._api.applyDelta(this._doc.version, delta).then(
      (value) => {
        this._event(Events.gotApplyDelta(expectedData, value.version, value.delta));
      },
      (error) => {
        this._event(Events.apiError('applyDelta', error));
      });

    return { state: 'merging' };
  }

  /**
   * In state `merging`, handles event `gotLocalDelta`. This generally means
   * that the user is making changes after we've sent a batch of user changes
   * to the server and before the server has gotten back to us with a response.
   */
  _handle_collecting_gotLocalDelta(event) {
    // Combine the new delta with the previous results of collection. If this
    // is the first during-merge change, initialize the delta.
    const oldDelta = this._collectedDelta;
    const newDelta = event.delta;
    this._collectedDelta = (oldDelta === null)
      ? new Delta(newDelta)
      : oldDelta.compose(newDelta);

    return { state: 'collecting' };
  }

  /**
   * In state `merging`, handles event `gotApplyDelta`. This means that a local
   * change was successfully merged by the server.
   */
  _handle_merging_gotApplyDelta(event) {
    const version = event.version;
    const delta = event.delta;
    const expectedData = event.expectedData;

    console.log('Received `applyDelta` response.')
    console.log(version);
    console.log(delta);

    // This is any addtional changes that have been made by Quill (presumably
    // because of user activity) while we were waiting for the server to get
    // back to us.
    const collectedDelta = this._collectedDelta;
    this._collectedDelta = null;

    if (DeltaUtil.isEmpty(delta)) {
      // There is no change from what we expected. This means that no other
      // client got in front of us between when we received the current version
      // and when we sent the delta to the server.
      if (DeltaUtil.isEmpty(collectedDelta)) {
        // Furthermore, the local user hasn't made any other changes while we
        // were waiting for the server to get back to us. This is the ideal
        // case, because it means Quill's state exactly matches the document
        // version we just received.
        this._updateDoc(version, expectedData, false);
        return IDLE_EVENT_TRANSITION;
      } else {
        // The local user has been merrily typing while the server has been
        // processing. We now have to turn that all into another delta to send
        // up to the server. What we do here is go back into the `idle` state
        // but with an immediate event that will kick off the collection
        // process. (That is, it is going to be a very short-lived idling.)
        const event =
          Events.gotLocalDelta(collectedDelta, this._doc.data, INTERNAL_SOURCE);
        this._updateDoc(version, expectedData, false);
        return { state: 'idle', event: event };
      }
    } else {
      // The server merged in some changes that we didn't expect.
      if (DeltaUtil.isEmpty(collectedDelta)) {
        // Thanfully, the local user hasn't made any other changes while we
        // were waiting for the server to get back to us. We need to tell
        // Quill about the changes, but we don't have to do additional merging.
        this._updateDoc(version, expectedData.compose(delta));
        return IDLE_EVENT_TRANSITION;
      } else {
        // The hard case, a/k/a "Several people are typing." The server got back
        // to us with a response that included changes we didn't know about,
        // *and* in the mean time the local user has been busy making changes of
        // their own. We need to "transform" (in OT terms) or "rebase" (in git
        // terms) the local changes to be on top of the new base document as
        // provided by the server.
        throw new Error('TODO: Rebase.');
      }
    }
  }

  /**
   * Updates `_doc` to have the given version and snapshot data, and tells the
   * attached Quill instance to update itself accordingly.
   *
   * @param version New version number.
   * @param data New snapshot data; expected to be a `Delta` object, and _not_
   * just a regular array.
   * @param updateQuill (default `true`) whether to inform Quill of this
   * update. This should only ever be passed as `false` when Quill is expected
   * to already have the changes to the document represented in `data`. (It
   * might _also_ have additional changes too.)
   */
  _updateDoc(version, data, updateQuill = true) {
    this._doc = {
      version: version,
      data: data
    }

    if (updateQuill) {
      this._quill.setContents(data, QUILL_SOURCE);
    }
  }
}
