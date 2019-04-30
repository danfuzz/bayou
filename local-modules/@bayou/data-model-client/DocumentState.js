// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from '@bayou/typecheck';

const DEFAULT_STATE = {
  /** {string} Document title. */
  title: 'Untitled'
};

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
        case SET_TITLE_ACTION: {
          const newState = Object.assign({}, state, { title: action.payload.title });
          return newState;
        }

        default: {
          return state;
        }
      }
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
      payload: {
        title
      }
    };
  }

  static title(state) {
    return state.document.title;
  }
}
