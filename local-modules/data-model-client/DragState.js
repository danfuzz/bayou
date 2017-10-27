// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt } from 'typecheck';

const DEFAULT_STATE = {
  // {Int|null} During a drag, the index the cursor is at.
  // Otherwise it is `null`.
  dragIndex: null
};

/** {string} Action type when updating the drag location. */
const UPDATE_DRAG_LOCATION_ACTION = 'update-drag-location-action';

/**
 * Class wrapper for the reducer and actions related to drag state.
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
        case UPDATE_DRAG_LOCATION_ACTION: {
          const newState = Object.assign({}, state, { dragIndex: action.payload.index });
          return newState;
        }

        default: {
          return state;
        }
      }
    };
  }

  /**
   * Creates a dispatch action object for updating the drag state.
   *
   * @param {Int|null} index The index at the cursor,
   *   or `null` if the drag has ended.
   * @returns {object} The dispatch action.
   */
  static setDragIndexAction(index) {
    if (index !== null) {
      TInt.nonNegative(index);
    }

    return {
      type: UPDATE_DRAG_LOCATION_ACTION,
      payload: {
        index
      }
    };
  }

  /**
   * Redux selector for the location of the file-drop coach mark.
   *
   * @param {object} state The redux state to query.
   * @returns {Int|null} If a drag is in progress returns the cursor
   *   position's offset into the Quill document. If there is no drag
   *   then `null` is returned.
   */
  static dragIndex(state) {
    return state.drag.dragIndex;
  }

}
