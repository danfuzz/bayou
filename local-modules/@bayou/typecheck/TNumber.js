// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Errors, UtilityClass } from '@bayou/util-core';

/**
 * Type checker for type `number`.
 */
export class TNumber extends UtilityClass {
  /**
   * Checks a value of type `number`.
   *
   * @param {*} value Value to check.
   * @returns {number} `value`.
   */
  static check(value) {
    if (typeof value !== 'number') {
      throw Errors.badValue(value, Number);
    }

    return value;
  }

  /**
   * Checks a value of type `number`, which must furthermore be within an
   * indicated inclusive-exclusive range.
   *
   * @param {*} value Value to check.
   * @param {number} minInc Minimum acceptable value (inclusive).
   * @param {number} maxExc Maximum acceptable value (exclusive).
   * @returns {number} `value`.
   */
  static range(value, minInc, maxExc) {
    TNumber.check(value);
    TNumber.check(minInc);
    TNumber.check(maxExc);

    if ((value < minInc) || (value >= maxExc)) {
      throw Errors.badValue(value, Number, `${minInc} <= value < ${maxExc}`);
    }

    return value;
  }

  /**
   * Checks a value of type `number`, which must furthermore be within an
   * indicated inclusive-inclusive range.
   *
   * @param {*} value Value to check.
   * @param {number} minInc Minimum acceptable value (inclusive).
   * @param {number} maxInc Maximum acceptable value (inclusive).
   * @returns {number} `value`.
   */
  static rangeInc(value, minInc, maxInc) {
    TNumber.check(value);
    TNumber.check(minInc);
    TNumber.check(maxInc);

    if ((value < minInc) || (value > maxInc)) {
      throw Errors.badValue(value, Number, `${minInc} <= value <= ${maxInc}`);
    }

    return value;
  }
}
