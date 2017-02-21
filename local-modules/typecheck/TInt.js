// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import TypeError from './TypeError';

/**
 * Type checker for type `Int`.
 *
 * **Note:** Even though there is no built-in JavaScript `Int` class, this
 * class follows the module's convention of using a `T` name prefix, so as to
 * keep things more straightforward.
 */
export default class TInt {
  /**
   * Checks a value of type `Int`.
   *
   * @param {*} value Value to check.
   * @returns {number} `value`.
   */
  static check(value) {
    if ((typeof value !== 'number') || !Number.isSafeInteger(value)) {
      return TypeError.badValue(value, 'Int');
    }

    return value;
  }

  /**
   * Checks a value of type `Int`, which must furthermore be at least an
   * indicated value (inclusive).
   *
   * @param {*} value Value to check.
   * @param {number} minInc Minimum acceptable value (inclusive).
   * @returns {number} `value`.
   */
  static min(value, minInc) {
    TInt.check(value);
    if (value < minInc) {
      return TypeError.badValue(value, 'Int', `value >= ${minInc}`);
    }

    return value;
  }

  /**
   * Checks a value of type `Int`, which must furthermore be within an indicated
   * inclusive-exclusive range.
   *
   * **Note:** This and `intRangeInc()` are both defined because their
   * respective errors convey different information.
   *
   * @param {*} value Value to check.
   * @param {number} minInc Minimum acceptable value (inclusive).
   * @param {number} maxExc Maximum acceptable value (exclusive).
   * @returns {number} `value`.
   */
  static range(value, minInc, maxExc) {
    TInt.check(value);
    if ((value < minInc) || (value >= maxExc)) {
      return TypeError.badValue(value, 'Int', `${minInc} <= value < ${maxExc}`);
    }

    return value;
  }

  /**
   * Checks a value of type `Int`, which must furthermore be within an indicated
   * inclusive-inclusive range.
   *
   * **Note:** This and `range()` are both defined because their respective
   * errors convey different information.
   *
   * @param {*} value Value to check.
   * @param {number} minInc Minimum acceptable value (inclusive).
   * @param {number} maxInc Maximum acceptable value (inclusive).
   * @returns {number} `value`.
   */
  static rangeInc(value, minInc, maxInc) {
    TInt.check(value);
    if ((value < minInc) || (value > maxInc)) {
      return TypeError.badValue(value, 'Int', `${minInc} <= value <= ${maxInc}`);
    }

    return value;
  }
}
