// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

const SHARING_STATE_EVERYONE = 'sharing-state-everyone';
const SHARING_STATE_UNKNOWN = 'sharing-state-unknown';

const DEFAULT_STATE = {
  /** {string} The sharing state of the document. */
  state: SHARING_STATE_UNKNOWN
};

/** {string} Action type to use when setting the sharing state. */
const SET_SHARING_STATE = 'set-sharing-state';

/**
 * A class wrapper to provide static/const getters for the values
 * indicating the sharing state of the current document.
 */
export default class SharingState {
  /**
   * {string} A sharing state indicating the document is visible to all
   *   users in the workspace.
   */
  static get EVERYONE() {
    return SHARING_STATE_EVERYONE;
  }

  /**
   * {string} A sharing state indicating that the state is unknown.
   */
  static get UNKNOWN() {
    return SHARING_STATE_UNKNOWN;
  }

  /** {function} Redux reducer for the top-level document state. */
  static get reducer() {
    return (state = DEFAULT_STATE, action) => {
      switch (action.type) {
        case SET_SHARING_STATE: {
          const newState = Object.assign({}, state, { state: action.payload.newState });
          return newState;
        }

        default: {
          return state;
        }
      }
    };
  }

  /**
   * Creates a dispatch action object for setting the sharing state.
   *
   * @param {string} newState The new sharing state for the document.
   * @returns {object} The dispatch action.
   */
  static setSharingStateAction(newState) {
    return {
      type: SET_SHARING_STATE,
      payload: {
        newState
      }
    };
  }

  /**
   * Redux selector for the sharing state of the document.
   *
   * @param {object} state The redux state to query.
   * @returns {string} The sharing state.
   */
  static sharingState(state) {
    return state.sharing.state;
  }
}
