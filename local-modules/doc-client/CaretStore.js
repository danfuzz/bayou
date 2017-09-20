// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { createStore } from 'redux';

import { Caret } from 'doc-common';
import { Delay } from 'promise-util';
import { TFunction, TString } from 'typecheck';

/**
 * {object} Starting state for the caret redux store.
 */
const INITIAL_STATE = {
  sessions: new Map()
};

/**
 * {string} Redux action to dispatch when a new caret is added.
 */
const ADD_CARET = 'add_caret';

/**
 * {string} Redux action to dispatch when a caret is updated.
 */
const UPDATE_CARET = 'update_caret';

/**
 * {string} Redux action to dispatch when a caret is removed.
 */
const REMOVE_CARET = 'remove_caret';

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
 * Tracker of the state of carets for all seesions editing a given document.
 * It watches for changes observed from the session proxy and dispatches
 * actions to a redux data store to update the client caret model.
 *
 * Other entities interested in caret changes (notably CaretOverly) should
 * use the `subscribe(callback)` method of this class.
 */
export default class CaretStore {
  /**
   * Constructs an instance of this class.
   *
   * @param {EditorComplex} editorComplex The editor environment in which this
   *   instance will operate.
   */
  constructor(editorComplex) {
    this._store = createStore(this._caretStoreReducer);

    this._watchCarets(editorComplex);
  }

  /**
   * {object} The current settled data model from the redux
   * store used for carets.
   */
  get state() {
    return this._store.getState();
  }

  /**
   * Adds a notification callback to the list of change subscribers
   * for the caret redux store.
   *
   * @param {function} callback A function to be called when the caret
   *   data model is changed. Note that it may not be called for each discrete
   *   change since the redux system may bundle individual mutations together.
   * @returns {function} A function to be used to unsubscribe the
   *   callback from future change notifications.
   */
  subscribe(callback) {
    TFunction.checkCallable(callback);

    return this._store.subscribe(callback);
  }

  /**
   * Redux root reducer function that transforms our actions into
   * state changes.
   * @see http://redux.js.org/docs/basics/Reducers.html
   *
   * @param {object} [state = INITIAL_STATE] The previous settled state, or
   *  `undefined` if no state has been set yet.
   * @param {object} action The
   * @returns {object} The new state after the action is applied.
   */
  _caretStoreReducer(state = INITIAL_STATE, action) {
    let newState;

    switch (action.type) {
      case ADD_CARET:
      case UPDATE_CARET:
        newState = Object.assign({}, state);
        newState.sessions = new Map(state.sessions);
        newState.sessions.set(action.sessionId, action.sessionInfo);
        break;

      case REMOVE_CARET:
        newState = Object.assign({}, state);
        newState.sessions = new Map(state.sessions);
        newState.sessions.delete(action.sessionId);
        break;

      default:
        // If we get an action we don't recognize we shouldn't be mutating
        // the state so just return what we were given.
        newState = state;
        break;
    }

    return newState;
  }

  /**
   * Watches for selection-related activity.
   *
   * @param {EditorComplex} editorComplex The editor environment to
   *   monitor for caret changes.
   */
  async _watchCarets(editorComplex) {
    await editorComplex.whenReady();

    let docSession = null;
    let snapshot = null;
    let sessionProxy;
    let sessionId;

    for (;;) {
      if (docSession === null) {
        // Init the session variables (on the first iteration), or re-init them
        // if we got a failure during a previous iteration.
        docSession   = editorComplex.docSession;
        sessionProxy = await docSession.getSessionProxy();

        // Can only get the session ID after we have a proxy. (Before that, the
        // ID might not be set, because the session might not even exist!)
        sessionId = editorComplex.sessionId;
      }

      try {
        if (snapshot !== null) {
          // We have a snapshot which we can presumably get a delta from, so try
          // to do that.
          const delta = await sessionProxy.caret_deltaAfter(snapshot.revNum);
          snapshot = snapshot.compose(delta);
          docSession.log.detail(`Got caret delta. ${snapshot.carets.length} caret(s).`);
        }
      } catch (e) {
        // Assume that the error isn't truly fatal. Most likely, it's because
        // the session got restarted or because the snapshot we have is too old
        // to get a delta from. We just `null` out the snapshot and let the next
        // clause try to get it afresh.
        docSession.log.warn('Trouble with `caret_deltaAfter`:', e);
        snapshot = null;
      }

      try {
        if (snapshot === null) {
          // We don't yet have a snapshot to base deltas off of, so get one!
          // This can happen either because we've just started a new session or
          // because the attempt to get a delta failed for some reason. (The
          // latter is why this section isn't just part of an `else` block to
          // the previous `if`).
          snapshot = await sessionProxy.caret_snapshot();
          docSession.log.detail(`Got ${snapshot.carets.length} new caret(s)!`);
        }
      } catch (e) {
        // Assume that the error is transient and most likely due to the session
        // getting terminated / restarted. Null out the session variables, wait
        // a moment, and try again.
        docSession.log.warn('Trouble with `caret_snapshot`:', e);
        docSession   = null;
        sessionProxy = null;
        await Delay.resolve(ERROR_DELAY_MSEC);
        continue;
      }

      const sessionState = this._store.getState().sessions;
      const oldSessions = new Set(sessionState.keys());

      for (const c of snapshot.carets) {
        if (c.sessionId === sessionId) {
          // Don't render the caret for this client.
          continue;
        }

        this._updateCaret(c);
        oldSessions.delete(c.sessionId);
      }

      // The remaining elements of `oldSessions` are sessions which have gone
      // away.
      for (const s of oldSessions) {
        docSession.log.info('Session ended:', s);
        this._endSession(s);
      }

      await Delay.resolve(REQUEST_DELAY_MSEC);
    }
  }

  /**
   * Begin tracking a new session.
   *
   * @param {Caret} caret The new caret to track (which includes a session ID).
   */
  _beginSession(caret) {
    Caret.check(caret);

    const info = new Map(Object.entries({ caret }));

    this._store.dispatch({
      type:        ADD_CARET,
      sessionId:   caret.sessionId,
      sessionInfo: info
    });
  }

  _updateSession(caret) {
    Caret.check(caret);

    const info = new Map(Object.entries({ caret }));

    this._store.dispatch({
      type:        UPDATE_CARET,
      sessionId:   caret.sessionId,
      sessionInfo: info
    });
  }

  /**
   * Stop tracking a given session.
   *
   * @param {string} sessionId The session to stop tracking.
   */
  _endSession(sessionId) {
    TString.check(sessionId);

    this._store.dispatch({
      type: REMOVE_CARET,
      sessionId
    });
  }

  /**
   * Updates annotation for a remote session's caret.
   * (e.g. the session's color changed)
   *
   * @param {Caret} caret The caret to update.
   */
  _updateCaret(caret) {
    Caret.check(caret);

    const sessionId = caret.sessionId;
    const sessions = this._store.getState().sessions;

    if (!sessions.has(sessionId)) {
      this._beginSession(caret);
    }

    const info     = this.state.sessions.get(sessionId);
    const oldCaret = info.get('caret');

    info.set('caret', caret);

    if ((caret.color !== oldCaret.color)
    ||  (caret.index !== oldCaret.index)
    ||  (caret.length !== oldCaret.length)) {
      this._updateSession(caret);
    }
  }
}
