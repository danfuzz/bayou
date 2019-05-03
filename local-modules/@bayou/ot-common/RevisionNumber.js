// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt } from '@bayou/typecheck';
import { Errors, UtilityClass } from '@bayou/util-common';

/**
 * Type representation of revision numbers. The values themselves are always
 * just non-negative integers. This is just where the type checker code lives.
 */
export class RevisionNumber extends UtilityClass {
  /**
   * Checks a value of type `RevisionNumber`.
   *
   * @param {*} value Value to check.
   * @returns {Int} `value`.
   */
  static check(value) {
    try {
      return TInt.nonNegative(value);
    } catch (e) {
      // More appropriate error.
      throw Errors.badValue(value, RevisionNumber);
    }
  }

  /**
   * Checks a value of type `RevisionNumber`, which must furthermore be less
   * than an indicated value.
   *
   * @param {*} value Value to check.
   * @param {Int} maxExc Maximum acceptable value (exclusive).
   * @returns {Int} `value`.
   */
  static maxExc(value, maxExc) {
    try {
      return TInt.range(value, 0, maxExc);
    } catch (e) {
      // More appropriate error.
      throw Errors.badValue(value, RevisionNumber, `value < ${maxExc}`);
    }
  }

  /**
   * Checks a value of type `RevisionNumber`, which must furthermore be no more
   * than an indicated value (inclusive).
   *
   * @param {*} value Value to check.
   * @param {Int} maxInc Maximum acceptable value (inclusive).
   * @returns {Int} `value`.
   */
  static maxInc(value, maxInc) {
    try {
      return TInt.rangeInc(value, 0, maxInc);
    } catch (e) {
      // More appropriate error.
      throw Errors.badValue(value, RevisionNumber, `value <= ${maxInc}`);
    }
  }

  /**
   * Checks a value of type `RevisionNumber`, which must furthermore be at least
   * an indicated value (inclusive).
   *
   * @param {*} value Value to check.
   * @param {Int} minInc Minimum acceptable value (inclusive).
   * @returns {Int} `value`.
   */
  static min(value, minInc) {
    try {
      return TInt.min(value, minInc);
    } catch (e) {
      // More appropriate error.
      throw Errors.badValue(value, RevisionNumber, `value >= ${minInc}`);
    }
  }

  /**
   * Checks a value which must be of type `RevisionNumber` or be the value `-1`.
   * The latter is used as an indicator in certain contexts that a file has no
   * revisions.
   *
   * @param {*} value Value to check.
   * @returns {Int} `value`.
   */
  static orNeg1(value) {
    try {
      return TInt.min(value, -1);
    } catch (e) {
      // More appropriate error.
      throw Errors.badValue(value, 'RevisionNumber | -1');
    }
  }
}
