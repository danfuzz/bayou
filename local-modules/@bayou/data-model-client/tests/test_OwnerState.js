// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { OwnerState } from '@bayou/data-model-client';

describe('@bayou/data-model-client/OwnerState', () => {
  it('returns default values when passed a null initial state', () => {
    const reducer = OwnerState.reducer;
    const state = reducer(undefined, { type: 'unknown_action' });

    assert.isNotNull(state);
  });

  it('does not change the state if passed an unknown action', () => {
    const reducer = OwnerState.reducer;
    const initialState = Object.freeze({ a:1, b:2, c:3 });
    const newState = reducer(initialState, { type: 'unknown_action' });

    assert.deepEqual(newState, initialState);
  });

  it('does not modify prior state object when applying a known action', () => {
    const reducer = OwnerState.reducer;

    // Pass in undefined initial state to get back the default values
    const initialState = Object.freeze(reducer(undefined, { type: 'unknown_action' }));

    const action = OwnerState.setOwnerNameAction('Hoopy Dude');

    // Since the intial state was frozen before being passed in this will
    // throw an exception if the reducer tries to modify it.
    assert.doesNotThrow(() => reducer(initialState, action));
  });

  it('updates the owner name state when passed the "set owner name" action', () => {
    const reducer = OwnerState.reducer;

    // Pass in undefined initial state to get back the default values
    const initialState = Object.freeze(reducer(undefined, { type: 'unknown_action' }));

    const initialOwnerState = initialState.name;
    const setNameAction = OwnerState.setOwnerNameAction('Hoopy Dude');
    const newState = reducer(initialState, setNameAction);
    const newOwnerState = newState.name;

    assert.isString(initialOwnerState);
    assert.isString(newOwnerState);
    assert.notEqual(newOwnerState, initialOwnerState);
    assert.equal(newOwnerState, 'Hoopy Dude');
  });
});
