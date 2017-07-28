// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt, TString } from 'typecheck';
import { ColorSelector, CommonBase } from 'util-common';

/**
 * {Caret|null} An instance with all default values. Initialized in the static
 * method of the same name.
 */
let EMPTY = null;

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
  /** {Caret} An instance with all default values. */
  static get EMPTY() {
    if (EMPTY === null) {
      EMPTY = new Caret('no-session', 0, 0, '#000000');
    }

    return EMPTY;
  }

  /**
   * Constructs an instance. Only the first argument (`sessionId`) is required;
   * though generally short-lived, instances constructed with the rest of the
   * arguments as defaults are used as the carets for newly-minted sessions.
   *
   * @param {string} sessionId An opaque token that can be used with other
   *   APIs to get information about the author whose caret this is (e.g. author
   *   name, avatar, user id, etc). No assumptions should be made about the
   *   format of `sessionId`.
   * @param {Int} [index = 0] The zero-based location of the caret (or beginning
   *   of a selection) within the document.
   * @param {Int} [length = 0] The number of characters within a selection, or
   *   zero if this caret merely represents the insertion point and not a
   *   selection.
   * @param {string} [color = '#000000'] The color to be used when annotating
   *   this caret. The color must be in the CSS three-byte hex form (e.g.
   *   `'#b8ff2e'`).
   */
  constructor(sessionId, index = 0, length = 0, color = '#000000') {
    super();

    /** {string} The session ID. */
    this._sessionId = TString.check(sessionId);

    /** {Map<string,*>} Map of all of the caret fields, from name to value. */
    this._fields = new Map([
      ['index',  TInt.nonNegative(index)],
      ['length', TInt.nonNegative(length)],
      ['color',  ColorSelector.checkHexColor(color)]
    ]);

    Object.freeze(this);
  }

  /**
   * {string} Opaque reference to be used with other APIs to get information
   * about the author whose caret this is.
   */
  get sessionId() {
    return this._sessionId;
  }

  /**
   * {Int} The zero-based leading position of this caret/selection.
   */
  get index() {
    return this._fields.get('index');
  }

  /**
   * {Int} The length of the selection, or zero if it is just an insertion point.
   */
  get length() {
    return this._fields.get('length');
  }

  /**
   * {string} The color to be used when annotating this selection. It is in CSS
   * three-byte hex format (e.g. `'#ffeab9'`).
   */
  get color() {
    return this._fields.get('color');
  }

  /**
   * Compares this to another instance, for equality of content.
   *
   * @param {Caret} other Caret to compare to.
   * @returns {boolean} `true` iff `this` and `other` have equal contents.
   */
  equals(other) {
    Caret.check(other);

    if (this._sessionId !== other._sessionId) {
      return false;
    }

    const fields = this._fields;
    for (const [k, v] of other._fields) {
      if (v !== fields.get(k)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    // Convert the `_fields` map to a simple object for the purpose of coding.
    const fields = {};
    for (const [k, v] of this._fields) {
      fields[k] = v;
    }

    return [this._sessionId, fields];
  }

  /**
   * Makes a new instance of this class from API arguments.
   *
   * @param {string} sessionId The session ID.
   * @param {object} fields The caret fields, as a simple object (not a map).
   * @returns {Caret} The new instance.
   */
  static fromApi(sessionId, fields) {
    return new Caret(sessionId, fields.index, fields.length, fields.color);
  }
}
