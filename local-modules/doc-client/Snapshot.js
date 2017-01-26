// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import DeltaUtil from 'delta-util';
import Typecheck from 'typecheck';

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

  /** The version number. */
  get verNum() {
    return this._verNum;
  }

  /** The document contents. */
  get contents() {
    return this._contents;
  }
}
