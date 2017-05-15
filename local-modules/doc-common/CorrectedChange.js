// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { FrozenDelta } from 'doc-common';
import { CommonBase } from 'util-common';

import VersionNumber from './VersionNumber';

/**
 * Representation of a corrected result of applying a delta. Instances of this
 * class are returned from `applyDelta()` as defined by the various `doc-server`
 * classes. See those for more details.
 *
 * Instances of this class are immutable.
 */
export default class CorrectedChange extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Int} verNum The version number of the document produced by the
   *   `applyDelta()` operation.
   * @param {FrozenDelta} delta The delta from the _expected_ change result to
   *   the _actual_ change result. The expectation is what was implied by the
   *   original arguments to `applyDelta()`.
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
    return 'CorrectedChange';
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
   * @returns {CorrectedChange} The constructed instance.
   */
  static fromApi(verNum, delta) {
    return new CorrectedChange(verNum, delta);
  }

  /** {Int} The produced version number. */
  get verNum() {
    return this._verNum;
  }

  /** {FrozenDelta} The actual change, as a delta. */
  get delta() {
    return this._delta;
  }
}
