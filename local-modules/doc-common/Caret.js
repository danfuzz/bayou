// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt, TString } from 'typecheck';
import { ColorSelector, CommonBase } from 'util-common';

/**
 * Information about the state of a single document editing session. Instances
 * of this class are always frozen (immutable).
 *
 * **Note:** The use of the term "caret" in this and other classes, method
 * names, and the like, is meant to be a synecdochal metaphor for all
 * information about a session, including the human driving it. The caret per
 * se is merely the most blatant aspect of it.
 */
export default class Caret extends CommonBase {
  /**
   * Constructs an instance.
   *
   *  @param {string} sessionId An opaque token that can be used with other
   *    APIs to get information about the author whose caret this is (e.g. author
   *    name, avatar, user id, etc). No assumptions should be made about the
   *    format of `sessionId`.
   * @param {Int} index The zero-based location of the caret (or beginning of a selection)
   *    within the document.
   * @param {Int} length The number of characters within a selection, or zero if
   *    this caret merely represents the insertion point and not a selection.
   *  @param {string} color The color to be used when annotating this caret. The
   *    color must be in the CSS three-byte hex form (e.g. `'#b8ff2e'`).
   */
  constructor(sessionId, index, length, color) {
    super();

    this._sessionId = TString.check(sessionId);
    this._index = TInt.min(index, 0);
    this._length = TInt.min(length, 0);
    this.color = ColorSelector.checkHexColor(color);

    Object.freeze(this);
  }

  /**
   * {Int} The zero-based leading position of this caret/selection.
   */
  get index() {
    return this._index;
  }

  /**
   * {Int} The length of the selection, or zero if it is just an insertion point.
   */
  get length() {
    return this._length;
  }

  /**
   * {string} The color to be used when annotating this selection. It is in CSS
   *   three-byte hex format (e.g. `'#ffeab9'`).
   */
  get color() {
    return this._color;
  }

  /**
   * {string} Opaque reference to be used with other APIs to get information about
   *   the author whose caret this is.
   */
  get sessionId() {
    return this._sessionId;
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._sessionId, this._index, this._length, this._color];
  }
}
