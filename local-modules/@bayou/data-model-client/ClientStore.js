// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CaretState } from '@bayou/doc-ui';
import { combineReducers, createStore } from 'redux';

import DocumentState from './DocumentState';
import DragState from './DragState';

/**
 * Wrapper for a redux store. Its main purpose is to compose the
 * reducers used by the various aspects of the data model.
 */
export default class ClientStore {
  /**
   * Constructs an instance.
   */
  constructor() {
    const rootReducer = combineReducers({
      carets:   CaretState.reducer,
      document: DocumentState.reducer,
      drag:     DragState.reducer,
    });

    this._store = createStore(rootReducer);
  }

  /**
   * {object} The redux store. The wrapped Redux store should
   * only be used when passing it as an argument to
   * redux-connect.
  */
  get store() {
    return this._store;
  }

  /**
   * Call-through to the Redux subscribe function.
   *
   * @param {function} callback a
   * @returns {function} The function to call to unsubscribe.
   */
  subscribe(callback) {
    return this._store.subscribe(callback);
  }

  /**
   * Call-through to the Redux `getState()` function.
   *
   * @returns {object} The current state of the store.
   */
  getState() {
    return this._store.getState();
  }

  /**
   * Call-through to the Redux `dispatch()` function.
   *
   * @param {object} action The action to dispatch to the store.
   */
  dispatch(action) {
    this._store.dispatch(action);
  }
}
