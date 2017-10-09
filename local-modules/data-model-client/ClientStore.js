// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { combineReducers, createStore } from 'redux';

import DocumentState from './DocumentState';
import OwnerState from './OwnerState';
import SharingState from './SharingState';

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
      document: DocumentState.reducer,
      owner:    OwnerState.reducer,
      sharing:  SharingState.reducer
    });

    this._store = createStore(rootReducer);
  }

  /** {object} The redux store. */
  get store() {
    return this._store;
  }
}
