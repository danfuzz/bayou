// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { SharingState } from '@bayou/data-model-client';

describe('@bayou/data-model-client/SharingState', () => {
  it('returns default values when passed a null initial state', () => {
    const reducer = SharingState.reducer;
    const state = reducer(undefined, { type: 'unknown_action' });

    assert.isNotNull(state);
  });

  it('does not change the state if passed an unknown action', () => {
    const reducer = SharingState.reducer;
    const initialState = Object.freeze({ a:1, b:2, c:3 });
    const newState = reducer(initialState, { type: 'unknown_action' });

    assert.deepEqual(newState, initialState);
  });

  it('does not modify prior state object when applying a known action', () => {
    const reducer = SharingState.reducer;

    // Pass in undefined initial state to get back the default values
    const initialState = Object.freeze(reducer(undefined, { type: 'unknown_action' }));

    const action = SharingState.setSharingStateAction(SharingState.EVERYONE);

    // Since the intial state was frozen before being passed in this will
    // throw an exception if the reducer tries to modify it.
    assert.doesNotThrow(() => reducer(initialState, action));
  });

  it('updates the sharing state when passed the "set sharing state" action', () => {
    const reducer = SharingState.reducer;

    // Pass in undefined initial state to get back the default values
    const initialState = Object.freeze(reducer(undefined, { type: 'unknown_action' }));

    const initialSharingState = initialState.state;
    const setStateAction = SharingState.setSharingStateAction(SharingState.EVERYONE);
    const newState = reducer(initialState, setStateAction);
    const newSharingState = newState.state;

    assert.notEqual(newSharingState, initialSharingState);
    assert.equal(newSharingState, SharingState.EVERYONE);
  });
});
