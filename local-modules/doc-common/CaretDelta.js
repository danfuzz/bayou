// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TArray } from 'typecheck';
import { CommonBase } from 'util-common';

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
   * @param {array<object>} ops Array of individual caret information
   *   modification operations.
   */
  constructor(ops) {
    super();

    /**
     * {array<object>} Array of operations to perform on the (implied) base
     * `CaretSnapshot` to produce the new revision.
     */
    this._ops = Object.freeze(TArray.check(ops));
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._ops];
  }

  /**
   * {array<object>} Array of operations to be applied. This is guaranteed to
   * be a frozen (immutable) value.
   */
  get ops() {
    return this._ops;
  }
}
