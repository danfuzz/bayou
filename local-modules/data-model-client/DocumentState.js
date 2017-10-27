// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';

const DEFAULT_STATE = {
  /** {boolean} Whether this document is favorited or not. */
  starred: false,
};

/** {string} Action type to use for toggling the star state. */
const TOGGLE_STAR_ACTION = 'toggle_star_action';

/** {string} Action type to use for setting the document title. */
const SET_TITLE_ACTION = 'set_title_action';

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

        case SET_TITLE_ACTION: {
          const newState = Object.assign({}, state, { title: action.title });
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
   * the star in the redux store.
   *
   * @returns {object} The dispatch action.
   */
  static toggleStarAction() {
    return {
      type: TOGGLE_STAR_ACTION
    };
  }

  /**
   * Creates a dispatch action object for setting the document title
   * in the redux store.
   *
   * @param {string} title The new title.
   * @returns {object} The dispatch action.
   */
  static setTitleAction(title) {
    TString.nonEmpty(title);

    return {
      type: SET_TITLE_ACTION,
      title
    };
  }
}
