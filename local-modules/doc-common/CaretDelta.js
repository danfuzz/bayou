// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TArray } from 'typecheck';
import { CommonBase } from 'util-common';

import RevisionNumber from './RevisionNumber';

/**
 * Delta for caret information. Instances of this class can be applied to
 * instances of `CaretSnapshot` to produce updated snapshots.
 *
 * Instances of this class are immutable.
 */
export default class CaretDelta extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Int} revNum Revision number of the caret information produced by
   *   this instance.
   * @param {array<object>} ops Array of individual caret information
   *   modification operations.
   */
  constructor(revNum, ops) {
    super();

    /** {Int} The produced revision number. */
    this._revNum = RevisionNumber.check(revNum);

    /**
     * {array<object>} Array of operations to perform on the (implied) base
     * `CaretSnapshot` to produce the new revision.
     */
    this._ops = Object.freeze(TArray.check(ops));
  }

  /** {string} Name of this class in the API. */
  static get API_NAME() {
    return 'CaretDelta';
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._revNum, this._ops];
  }

  /**
   * Constructs an instance from API arguments.
   *
   * @param {Int} revNum Same as with the regular constructor.
   * @param {array<object>} ops Same as with the regular constructor.
   * @returns {CaretDelta} The constructed instance.
   */
  static fromApi(revNum, ops) {
    return new CaretDelta(revNum, ops);
  }

  /** {Int} The produced revision number. */
  get revNum() {
    return this._revNum;
  }

  /**
   * {array<object>} Array of operations to be applied. This is guaranteed to
   * be a frozen (immutable) value.
   */
  get ops() {
    return this._ops;
  }
}
