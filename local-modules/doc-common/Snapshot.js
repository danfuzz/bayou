// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Typecheck from 'typecheck';

import DeltaUtil from './DeltaUtil';

/**
 * Snapshot of a document, with other associated information.
 */
export default class Snapshot {
  /**
   * Constructs an instance.
   *
   * @param {number} verNum Version number of the document.
   * @param {Delta|array|object} contents Document contents. Can be given
   *   anything that can be coerced into a `FrozenDelta`.
   */
  constructor(verNum, contents) {
    /** Version number. */
    this._verNum = Typecheck.intMin(verNum, 0);

    /** Document contents. */
    this._contents = DeltaUtil.coerce(contents);

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
