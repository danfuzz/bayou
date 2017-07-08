// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

import FrozenDelta from './FrozenDelta';
import RevisionNumber from './RevisionNumber';


/**
 * Snapshot of document contents, with other associated information.
 */
export default class DocumentSnapshot extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {RevisionNumber} revNum Revision number of the document.
   * @param {Delta|array|object} contents Document contents. Can be given
   *   anything that can be coerced into a `FrozenDelta`. Must be a "document"
   *   (that is, a delta consisting only of `insert` operations).
   */
  constructor(revNum, contents) {
    super();

    /** {Int} Revision number. */
    this._revNum = RevisionNumber.check(revNum);

    /** {FrozenDelta} Document contents. */
    this._contents = FrozenDelta.coerce(contents);

    // Explicitly check that the `contents` delta has the form of a "document,"
    // that is, the only operations are `insert`s. For very large documents,
    // this might turn out to be a prohibitively slow operation, so...
    //
    // **TODO:** Evaluate how expensive this is in practice, and figure out a
    // better tactic if need be.
    //
    // **TODO:** There is more to being valid than just being `isDocument()`,
    // i.e. the ops themselves have to be valid in the contents of this project.
    // That validity should also be enforced.
    if (!this._contents.isDocument()) {
      throw new Error(
        'Expected `contents` to be a "document" (insert-only delta).');
    }

    Object.freeze(this);
  }

  /** {string} Name of this class in the API. */
  static get API_NAME() {
    return 'DocumentSnapshot';
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._revNum, this._contents];
  }

  /**
   * Constructs an instance from API arguments.
   *
   * @param {number} revNum Same as regular constructor.
   * @param {Delta|array|object} contents Same as regular constructor.
   * @returns {DocumentSnapshot} The constructed instance.
   */
  static fromApi(revNum, contents) {
    return new DocumentSnapshot(revNum, contents);
  }

  /** {RevisionNumber} The revision number. */
  get revNum() {
    return this._revNum;
  }

  /** {FrozenDelta} The document contents. */
  get contents() {
    return this._contents;
  }
}
