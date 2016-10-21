// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Delta from 'quill-delta';

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
 * Tag used to identify this module as the source of action on a Quill
 * instance.
 */
const QUILL_SOURCE = 'document-plumbing';

/**
 * Plumbing between Quill on the client and the document model on the server.
 */
export default class DocumentPlumbing {
  /**
   * Constructs an instance. As a side effect, sets up the linkage between
   * the two entities in question. Assuming the network is up, soon after
   * construction the first version of the doc will get sent to the client.
   *
   * @param `quill` Quill editor instance.
   * @param `api` `ApiClient` instance.
   */
  constructor(quill, api) {
    /** Editor object. */
    this._quill = quill;

    /** API interface. */
    this._api = api;

    /**
     * Latest document as reported from the server. Includes both version number
     * and actual data (a from-empty Delta).
     */
    this._latest = null;

    /**
     * Changes that have been made locally since the most recent update to
     * `_latest`, in the form of a Delta. Will be `null` if there are no
     * pending local changes.
     *
     * **Note:** It is on the transition of this field from `null` to non-empty
     * that a timer gets set up to handle the changes.
     */
    this._localChanges = null;

    // Get the initial document state from the server.
    api.snapshot().then(
      (result) => {
        result.data = new Delta(result.data);
        this._latest = result;
        quill.setContents(result.data, 'api');

        // Once we have initial contents, we can usefully handle changes coming
        // from Quill. So, we attach an event handler and tell Quill to start
        // accepting user input. (Before this, Quill shouldn't have been sending
        // any events anyway, but adding the event handler here is a more
        // prophylactic arrangement.)
        quill.on('text-change', this._handleLocalTextChange.bind(this));
        quill.enable();

        // And we also fire off the first request for changes coming from the
        // server side. This becomes a self-perpetuating process.
        this._getServerChanges();
      },
      (error) => {
        throw new Error(error);
      }
    );
  }

  /**
   * Asks for a delta from the server side, representing one or more changes
   * that this client hasn't yet seen. When the delta arrives, this will
   * integrate it, propagate it to the editor, and then kick off a new
   * iteration of the process.
   *
   * **Note:** The server won't actually return a result until there is a
   * change, so there's no need to poll (though &mdash; TODO &mdash; ultimately
   * we might want to have a timeout for error recovery in the face of a flaky
   * network connection).
   *
   * **Note:** We drive the process of getting changes from the server purely
   * as a client-to-server "pull" in order to keep the model simpler. In
   * particular, with this arrangement the transport-level concerns about
   * keeping a held-open connection (such as a websocket) open are more cleanly
   * separated from the higher-level application logic of synchronizing document
   * changes. It similarly helps maintain flexibility in choice of transport.
   */
  _getServerChanges() {
    // We grab the latest, so we can refer back to it when the response comes.
    // That is, `_latest` might have changed out from under us.
    const baseDoc = this._latest;

    this._api.deltaAfter(baseDoc.version).then(
      (result) => {
        const version = result.version;
        const delta = result.delta;
        console.log('Delta from server');
        console.log(result);

        // We only take action if the result version is newer than what we
        // have as the latest. That is, we might have what amounts to a stale
        // response which should be ignored. In particular, `_latest` can change
        // because of action related to local changes.
        if (version > this._latest.version) {
          // Build the new doc based on the base version and the received delta.
          const newDoc = baseDoc.data.compose(delta);
          this._latest = {
            version: result.version,
            data: newDoc
          };

          // Tell Quill. TODO: Gotta do something more in order to handle the
          // case where there are local changes that aren't yet reflected in
          // the server's version of the document.
          this._quill.setContents(newDoc, QUILL_SOURCE);
        }

        // Fire off the next iteration. We do this in a `setTimeout()` for two
        // reasons: (1) We want to pace requests at least a bit. (2) To break
        // the promise causality chain back to the current iteration (which,
        // if unbrokent, would lead to all of the iterations getting linked,
        // which is to say a memory leak waiting to happen).
        setTimeout(this._getServerChanges.bind(this), PULL_DELAY_MSEC);
      },
      (error) => {
        throw new Error(error);
      }
    );
  }

  /**
   * Handles a `text-change` event coming from Quill. **Note:** `oldDelta` is a
   * representation of the whole document, not just the previous change.
   */
  _handleLocalTextChange(delta, oldDelta, source) {
    if (source === QUILL_SOURCE) {
      // This delta was generated because of action taken by this class.
      return;
    }

    if (this._localChanges === null) {
      // We are about to have the first change. Set a timer to wait for further
      // changes and then handle them en masse.
      setTimeout(this._pushChanges.bind(this), PUSH_DELAY_MSEC);
      this._localChanges = delta;
    } else {
      // Combine the new delta with the one we already had.
      this._localChanges = this._localChanges.compose(delta);
    }
  }

  /**
   * Pushes the changes that have been made locally up to the server, if any.
   */
  _pushChanges() {
    const delta = this._localChanges;

    if (delta === null) {
      // There weren't actually any changes. This is unusual, though possible:
      // We might be in this call because of a timed call from
      // `_handleLocalTextChange()`, but in the mean time the queue got serviced
      // for other reasons.
      return;
    }

    // Construct the document (from-empty Delta) that we expect to be the result
    // of applying the pending change. In fact, we might end up with something
    // else from the server, but if so it is going to be represented as a delta
    // from what we've built here.
    const expectedDoc = this._latest.data.compose(delta);

    // Reset the queue, so we can start collecting more changes afresh.
    // TODO: Gotta do something more in order to handle additional changes
    // happening while the current delta is in-flight.
    this._localChanges = null;

    // Send the delta, and handle the response.
    this._api.applyDelta(this._latest.version, delta).then(
      (result) => {
        console.log('Received `applyDelta` response.')
        console.log(result.version);
        console.log(result.delta);
        const newDoc = (result.delta.length === 0)
          ? expectedDoc
          : expectedDoc.compose(result.delta);

        this._latest = {
          version: result.version,
          data: newDoc
        };

        if (newDoc !== expectedDoc) {
          // The server merged in some changes that we didn't expect. Tell
          // Quill. TODO: Gotta do something more in order to handle additional
          // changes that happened between when we sent a delta to the server
          // and got the response we're now handling.
          this._quill.setContents(newDoc, QUILL_SOURCE);
        }
      },
      (error) => {
        throw new Error(error)
      }
    );
  }
};
