// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { DragState } from '@bayou/data-model-client';

describe('@bayou/data-model-client/DragState', () => {
  it('returns default values when passed a null initial state', () => {
    const reducer = DragState.reducer;
    const state = reducer(undefined, { type: 'unknown_action' });

    assert.isNotNull(state);
  });

  it('does not change the state if passed an unknown action', () => {
    const reducer = DragState.reducer;
    const initialState = Object.freeze({ a:1, b:2, c:3 });
    const newState = reducer(initialState, { type: 'unknown_action' });

    assert.deepEqual(newState, initialState);
  });

  it('does not modify prior state object when applying a known action', () => {
    const reducer = DragState.reducer;

    // Pass in undefined initial state to get back the default values
    const initialState = Object.freeze(reducer(undefined, { type: 'unknown_action' }));

    const action = DragState.setDragIndexAction(37);

    // Since the intial state was frozen before being passed in this will
    // throw an exception if the reducer tries to modify it.
    assert.doesNotThrow(() => reducer(initialState, action));
  });

  it('updates the drag index state when passed the "set drag index" action', () => {
    const reducer = DragState.reducer;

    // Pass in undefined initial state to get back the default values
    const initialState = Object.freeze(reducer(undefined, { type: 'unknown_action' }));

    const initialDragState = initialState.dragIndex;
    const setDragAction = DragState.setDragIndexAction(37);
    const newState = reducer(initialState, setDragAction);
    const newDragState = newState.dragIndex;

    assert.isNull(initialDragState);
    assert.isNumber(newDragState);
    assert.equal(newDragState, 37);
  });
});
