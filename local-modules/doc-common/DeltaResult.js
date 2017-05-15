// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { FrozenDelta } from 'doc-common';
import { CommonBase } from 'util-common';

import VersionNumber from './VersionNumber';

/**
 * Delta-bearing result of an API call, which also comes with a version number.
 * Instances of this class are returned from calls to `applyDelta()` and
 * `deltaAfter()` as defined by the various `doc-server` classes. See those for
 * more details.
 *
 * Note that the meaning of the `delta` value is different depending on which
 * method the result came from. In particular, there is an implied "expected"
 * result from `applyDelta()` which this instance's `delta` is with respect to.
 *
 * Instances of this class are immutable.
 */
export default class DeltaResult extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Int} verNum Version number of the document.
   * @param {FrozenDelta} delta Delta which can be applied in context to
   *   produce the document with the indicated version number.
   */
  constructor(verNum, delta) {
    super();

    /** The produced version number. */
    this._verNum = VersionNumber.check(verNum);

    /** The actual change, as a delta. */
    this._delta = FrozenDelta.check(delta);
  }

  /** Name of this class in the API. */
  static get API_NAME() {
    return 'DeltaResult';
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._verNum, this._delta];
  }

  /**
   * Constructs an instance from API arguments.
   *
   * @param {Int} verNum Same as with the regular constructor.
   * @param {FrozenDelta} delta Same as with the regular constructor.
   * @returns {DeltaResult} The constructed instance.
   */
  static fromApi(verNum, delta) {
    return new DeltaResult(verNum, delta);
  }

  /** {Int} The produced version number. */
  get verNum() {
    return this._verNum;
  }

  /**
   * {FrozenDelta} Delta used to produce the document with version number
   * `verNum`.
   */
  get delta() {
    return this._delta;
  }
}
