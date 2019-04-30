// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CaretSnapshot } from '@bayou/doc-common';
import { RevisionNumber } from '@bayou/ot-common';
import { Condition, Delay } from '@bayou/promise-util';
import { Errors } from '@bayou/util-common';

/**
 * {CaretSnapshot} Starting state for the caret redux store.
 */
const INITIAL_STATE = CaretSnapshot.EMPTY;

/**
 * {string} Redux action to dispatch when we receive a new caret snapshot.
 */
const CARET_SNAPSHOT_UPDATED = 'caret_getSnapshot_updated';

/**
 * {Int} Amount of time (in msec) to wait after receiving a caret update from
 * the server before requesting another one. This is to prevent the client from
 * inundating the server with requests when there is some particularly active
 * editing going on.
 */
const REQUEST_DELAY_MSEC = 250;

/**
 * {Int} Amount of time (in msec) to wait after a failure to communicate with
 * the server, before trying to reconnect.
 */
const ERROR_DELAY_MSEC = 5000;

/**
 * Tracker of the state of all carets (active editing sessions) on a given
 * document. It watches for changes observed from the session proxy and
 * dispatches actions to a redux data store to update the client caret model.
 */
export default class CaretState {
  /**
   * Redux root reducer function that transforms our actions into
   * state changes.
   * @see http://redux.js.org/docs/basics/Reducers.html
   *
   * @returns {function} The reducer function.
   */
  static get reducer() {
    return (state = INITIAL_STATE, action) => {
      let newState;

      switch (action.type) {
        case CARET_SNAPSHOT_UPDATED:
          newState = action.snapshot;
          break;

        default:
          // If we get an action we don't recognize we shouldn't be mutating
          // the state so just maintain the current state.
          newState = state;
          break;
      }

      return newState;
    };
  }

  /**
   * Constructs an instance of this class.
   *
   * @param {EditorComplex} editorComplex The editor environment in which this
   *   instance will operate.
   */
  constructor(editorComplex) {
    /**
     * {EditorComplex} The editor complex which this instance is associated
     * with.
     */
    this._editorComplex = editorComplex;

    /** {ClientStore} Redux store. */
    this._store = editorComplex.clientStore;

    /**
     * {CaretSnapshot|null} The latest-known snapshot, or `null` if no snapshot
     * has yet been retrieved.
     */
    this._snapshot = null;

    /**
     * {Condition} Condition that becomes briefly `true` every time
     * {@link #_snapshot} is updated.
     */
    this._updateCondition = new Condition();

    // Start watching for caret changes.
    this._watchCarets(editorComplex);

    Object.seal(this);
  }

  /**
   * Gets the latest-known snapshot of carets.
   *
   * @returns {CaretSnapshot} Latest snapshot of caret state.
   */
  async getSnapshot() {
    while (this._snapshot === null) {
      await this._updateCondition.whenTrue();
    }

    return this._snapshot;
  }

  /**
   * Gets the latest-known snapshot of carets, so long as it is more recent than
   * the indicated revision. This method will wait until such a revision is
   * available.
   *
   * @param {Int} revNum Revision number after which a snapshot
   * @returns {CaretSnapshot} Latest snapshot of caret state, guaranteed to have
   *   `snapshot.revNum > revNum`.
   */
  async getSnapshotAfter(revNum) {
    RevisionNumber.check(revNum);

    for (;;) {
      const snapshot = await this.getSnapshot();
      if (snapshot.revNum > revNum) {
        return snapshot;
      }

      await this._updateCondition.whenTrue();
    }
  }

  /**
   * Watches for selection-related activity.
   *
   * @param {EditorComplex} editorComplex The editor environment to
   *   monitor for caret changes.
   */
  async _watchCarets(editorComplex) {
    await editorComplex.whenReady();

    let docSession   = null;
    let sessionProxy = null;

    for (;;) {
      if (docSession === null) {
        // Init the session variables (on the first iteration), or re-init them
        // if we got a failure during a previous iteration.
        docSession   = editorComplex.docSession;
        sessionProxy = await docSession.getSessionProxy();
      }

      let snapshot = this._snapshot;

      try {
        if (snapshot !== null) {
          // We have a snapshot which we can presumably get a change with
          // respect to, so try to do that.
          const change = await sessionProxy.caret_getChangeAfter(snapshot.revNum);
          snapshot = snapshot.compose(change);
          docSession.log.detail(`Got caret change. ${snapshot.size} caret(s).`);
        }
      } catch (e) {
        if (Errors.is_timedOut(e)) {
          // Timeout is totally NBD; it just means that nothing changed. No need
          // to log, and just iterate to retry the call.
          continue;
        }

        // Assume that the error isn't truly fatal. Most likely, it's because
        // the session got restarted or because the snapshot we have is too old
        // to get a change from. We just `null` out the snapshot and let the
        // next clause try to get it afresh.
        docSession.log.warn('Trouble with `caret_getChangeAfter`:', e);
        snapshot = null;
      }

      try {
        if (snapshot === null) {
          // We don't yet have a snapshot to base deltas off of, so get one!
          // This can happen either because we've just started a new session or
          // because the attempt to get a change failed for some reason. (The
          // latter is why this section isn't just part of an `else` block to
          // the previous `if`).
          snapshot = await sessionProxy.caret_getSnapshot();
          docSession.log.detail(`Got ${snapshot.size} new caret(s)!`);
        }
      } catch (e) {
        // Assume that the error is transient and most likely due to the session
        // getting terminated / restarted. Null out the session variables, wait
        // a moment, and try again.
        docSession.log.warn('Trouble with `caret_getSnapshot`:', e);
        docSession   = null;
        sessionProxy = null;
        await Delay.resolve(ERROR_DELAY_MSEC);
        continue;
      }

      if (snapshot !== null) {
        this._snapshot = snapshot;
        this._updateCondition.onOff();
        this._store.dispatch({
          type: CARET_SNAPSHOT_UPDATED,
          snapshot
        });
      }

      await Delay.resolve(REQUEST_DELAY_MSEC);
    }
  }
}
