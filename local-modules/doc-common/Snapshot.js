// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

import FrozenDelta from './FrozenDelta';
import VersionNumber from './VersionNumber';


/**
 * Snapshot of a document, with other associated information.
 */
export default class Snapshot extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {number} verNum Version number of the document.
   * @param {Delta|array|object} contents Document contents. Can be given
   *   anything that can be coerced into a `FrozenDelta`. Must be a "document"
   *   (that is, a delta consisting only of `insert` operations).
   */
  constructor(verNum, contents) {
    super();

    /** Version number. */
    this._verNum = VersionNumber.check(verNum);

    /** Document contents. */
    this._contents = FrozenDelta.coerce(contents);

    // Explicitly check that the `contents` delta has the form of a "document,"
    // that is, the only operations are `insert`s. For very large documents,
    // this might turn out to be a prohibitively slow operation, so... TODO:
    // Evaluate how expensive this is in practice, and figure out a better
    // tactic if need be.
    if (!this._contents.isDocument()) {
      throw new Error(
        'Expected `contents` to be a "document" (insert-only delta).');
    }

    Object.freeze(this);
  }

  /** Name of this class in the API. */
  static get API_NAME() {
    return 'Snapshot';
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._verNum, this._contents];
  }

  /**
   * Constructs an instance from API arguments.
   *
   * @param {number} verNum Same as regular constructor.
   * @param {Delta|array|object} contents Same as regular constructor.
   * @returns {Snapshot} The constructed instance.
   */
  static fromApi(verNum, contents) {
    return new Snapshot(verNum, contents);
  }

  /** The version number. */
  get verNum() {
    return this._verNum;
  }

  /** The document contents. */
  get contents() {
    return this._contents;
  }
}
