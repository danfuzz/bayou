// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import SharingState from './SharingState';

const DEFAULT_STATE = {
  /** {boolean} Whether this document is favorited or not. */
  starred: false,
  sharingStatus: SharingState.UNKNOWN
};

/** {string} Action type to use for toggling the star state. */
const TOGGLE_STAR_ACTION = 'toggle-star-action';

/**
 * Class wrapper for the reducer and actions related to top-level
 * document state.
 */
export default class DocumentState {
  /**
   * Redux reducer for the top-level document state.
   *
   * @returns {function} The reducer function.
   */
  static get reducer() {
    return (state = DEFAULT_STATE, action) => {
      switch (action.type) {
        case TOGGLE_STAR_ACTION: {
          const newState = Object.assign({}, state, { starred: !state.starred });
          return newState;
        }

        default: {
          return state;
        }
      }
    };
  }

  /**
   * Creates a dispatch action object for toggling the state of
   * the star in the reduce store.
   *
   * @returns {object} The dispatch action.
   */
  static toggleStarAction() {
    return {
      type: TOGGLE_STAR_ACTION
    };
  }
}
