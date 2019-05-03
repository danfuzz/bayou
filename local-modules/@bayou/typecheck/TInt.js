// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CoreTypecheck, Errors, UtilityClass } from '@bayou/util-core';

/**
 * Type checker for type `Int`.
 *
 * **Note:** Even though there is no built-in JavaScript `Int` class, this
 * class follows the module's convention of using a `T` name prefix, so as to
 * keep things more straightforward.
 */
export class TInt extends UtilityClass {
  /**
   * Checks a value of type `Int`.
   *
   * @param {*} value Value to check.
   * @returns {Int} `value`.
   */
  static check(value) {
    return CoreTypecheck.checkInt(value);
  }

  /**
   * Checks a value of type `Int`, which must furthermore be less than an
   * indicated value.
   *
   * @param {*} value Value to check.
   * @param {Int} maxExc Maximum acceptable value (exclusive).
   * @returns {Int} `value`.
   */
  static maxExc(value, maxExc) {
    return CoreTypecheck.checkInt(value, null, maxExc);
  }

  /**
   * Checks a value of type `Int`, which must furthermore be no more than an
   * indicated value (inclusive).
   *
   * @param {*} value Value to check.
   * @param {Int} maxInc Maximum acceptable value (inclusive).
   * @returns {Int} `value`.
   */
  static maxInc(value, maxInc) {
    TInt.check(value);
    TInt.check(maxInc);

    if (value > maxInc) {
      throw Errors.badValue(value, 'Int', `value <= ${maxInc}`);
    }

    return value;
  }

  /**
   * Checks a value of type `Int`, which must furthermore be at least an
   * indicated value (inclusive).
   *
   * @param {*} value Value to check.
   * @param {Int} minInc Minimum acceptable value (inclusive).
   * @returns {Int} `value`.
   */
  static min(value, minInc) {
    return CoreTypecheck.checkInt(value, minInc);
  }

  /**
   * Checks a value of type `Int`, which must furthermore be a non-negative
   * number.
   *
   * @param {*} value Value to check.
   * @returns {Int} `value`.
   */
  static nonNegative(value) {
    return CoreTypecheck.checkInt(value, 0);
  }

  /**
   * Checks a value of type `Int`, which must furthermore be within an indicated
   * inclusive-exclusive range.
   *
   * **Note:** This and `rangeInc()` are both defined because their respective
   * errors convey different information.
   *
   * @param {*} value Value to check.
   * @param {Int} minInc Minimum acceptable value (inclusive).
   * @param {Int} maxExc Maximum acceptable value (exclusive).
   * @returns {Int} `value`.
   */
  static range(value, minInc, maxExc) {
    return CoreTypecheck.checkInt(value, minInc, maxExc);
  }

  /**
   * Checks a value of type `Int`, which must furthermore be within an indicated
   * inclusive-inclusive range.
   *
   * **Note:** This and `range()` are both defined because their respective
   * errors convey different information.
   *
   * @param {*} value Value to check.
   * @param {Int} minInc Minimum acceptable value (inclusive).
   * @param {Int} maxInc Maximum acceptable value (inclusive).
   * @returns {Int} `value`.
   */
  static rangeInc(value, minInc, maxInc) {
    TInt.check(value);
    TInt.check(minInc);
    TInt.check(maxInc);

    if ((value < minInc) || (value > maxInc)) {
      throw Errors.badValue(value, 'Int', `${minInc} <= value <= ${maxInc}`);
    }

    return value;
  }

  /**
   * Checks a value of type `Int`, which must furthermore be within the
   * inclusive range `0..255`.
   *
   * @param {*} value Value to check.
   * @returns {Int} `value`.
   */
  static unsignedByte(value) {
    return TInt.rangeInc(value, 0, 255);
  }
}
