// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

const DEFAULT_STATE = {
  /** {string} The display name of the document owner */
  name: 'Unknown User'
};

/** {string} Action type to use for setting the owner name. */
const SET_OWNER_NAME_ACTION = 'set-owner-name-action';

/**
 * Class wrapper for the reducer and actions related to the owner
 * of this document.
 */
export default class OwnerState {
  /**
   * Redux reducer for the top-level document state.
   *
   * @returns {function} The reducer function.
   */
  static get reducer() {
    return (state = DEFAULT_STATE, action) => {
      switch (action.type) {
        case SET_OWNER_NAME_ACTION:
          return Object.assign({}, state, { name: action.newName });

        default: {
          return state;
        }
      }
    };
  }

  /**
   * Creates a dispatch action object for setting the owner's name.
   *
   * @param {string} newName The new display name for the document owner.
   * @returns {object} The dispatch action.
   */
  static setOwnerName(newName) {
    return {
      type: SET_OWNER_NAME_ACTION,
      newName
    };
  }
}
