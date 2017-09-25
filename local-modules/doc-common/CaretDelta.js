// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { TArray } from 'typecheck';
import { CommonBase } from 'util-common';

import CaretOp from './CaretOp';

/**
 * {CaretDelta|null} Empty instance. Initialized in the static getter of the
 * same name.
 */
let EMPTY = null;

/**
 * Delta for caret information, consisting of a simple ordered list of
 * operations. Instances of this class can be applied to instances of `Caret`
 * and `CaretSnapshot` to produce updated instances of those classes.
 *
 * Instances of this class are immutable.
 */
export default class CaretDelta extends CommonBase {
  /** {CaretDelta} Empty instance. */
  static get EMPTY() {
    if (EMPTY === null) {
      EMPTY = new CaretDelta([]);
    }

    return EMPTY;
  }

  /**
   * Constructs an instance.
   *
   * @param {array<CaretOp>} ops Array of individual caret information
   *   modification operations.
   */
  constructor(ops) {
    super();

    /**
     * {array<object>} Array of operations to perform on the (implied) base
     * `CaretSnapshot` to produce the new revision.
     */
    this._ops = Object.freeze(TArray.check(ops, CaretOp.check));
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
   * {array<CaretOp>} Array of operations to be applied. This is guaranteed to
   * be a frozen (immutable) value.
   */
  get ops() {
    return this._ops;
  }

  /**
   * Gets a human-oriented string representation of this instance.
   *
   * @returns {string} The human-oriented representation.
   */
  toString() {
    const name = this.constructor.name;
    const body = inspect(this._ops);

    return `${name} ${body}`;
  }
}
