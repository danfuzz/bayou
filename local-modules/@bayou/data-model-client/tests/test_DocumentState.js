// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { DocumentState } from '@bayou/data-model-client';

describe('@bayou/data-model-client/DocumentState', () => {
  it('returns default values when passed an undefined initial', () => {
    const reducer = DocumentState.reducer;
    const state = reducer(undefined, { type: 'unknown_action' });

    assert.isNotNull(state);
  });

  it('does not change the state if passed an unknown action', () => {
    const reducer = DocumentState.reducer;
    const initialState = Object.freeze({ a:1, b:2, c:3 });
    const newState = reducer(initialState, { type: 'unknown_action' });

    assert.deepEqual(newState, initialState);
  });

  it('updates the title state when passed the "set title" action', () => {
    const reducer = DocumentState.reducer;

    // Pass in undefined initial state to get back the default values
    const initialState = Object.freeze(reducer(undefined, { type: 'unknown_action' }));

    const initialTitleState = initialState.title;
    const setTitleAction = DocumentState.setTitleAction('my awesome new title');
    const newState = reducer(initialState, setTitleAction);
    const newTitleState = newState.title;

    assert.isString(initialTitleState);
    assert.isString(newTitleState);
    assert.notEqual(newTitleState, initialTitleState);
  });
});
