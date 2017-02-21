// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import TypeError from './TypeError';

/**
 * Type checking and validation for various types. This is a catch-all that is
 * in the process of being split apart.
 */
export default class Typecheck {
  /**
   * Checks a value of type array.
   *
   * @param {*} value The (alleged) array.
   * @returns {array} `value`.
   */
  static array(value) {
    if (!Array.isArray(value)) {
      return TypeError.badValue(value, 'array');
    }

    return value;
  }

  /**
   * Checks a value of type boolean.
   *
   * @param {*} value The (alleged) boolean.
   * @param {boolean|null} [defaultValue = null] Default value. If passed,
   *   indicates that `undefined` should be treated as that value. If not
   *   passed, `undefined` is an error.
   * @returns {boolean} `value` or `defaultValue`.
   */
  static boolean(value, defaultValue = null) {
    if ((value === undefined) && (defaultValue !== null)) {
      value = defaultValue;
    }

    if (typeof value !== 'boolean') {
      return TypeError.badValue(value, 'boolean');
    }

    return value;
  }

  /**
   * Checks a value of type `int`, which must furthermore be at least an
   * indicated value (inclusive).
   *
   * @param {*} value Value to check.
   * @param {number} minInc Minimum acceptable value (inclusive).
   * @returns {number} `value`.
   */
  static intMin(value, minInc) {
    if (   (typeof value !== 'number')
        || !Number.isSafeInteger(value)
        || (value < minInc)) {
      return TypeError.badValue(value, 'int', `value >= ${minInc}`);
    }

    return value;
  }

  /**
   * Checks a value of type `int`, which must furthermore be within an indicated
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
  static intRange(value, minInc, maxExc) {
    if (   (typeof value !== 'number')
        || !Number.isSafeInteger(value)
        || (value < minInc)
        || (value >= maxExc)) {
      return TypeError.badValue(value, 'int', `${minInc} <= value < ${maxExc}`);
    }

    return value;
  }

  /**
   * Checks a value of type `int`, which must furthermore be within an indicated
   * inclusive-inclusive range.
   *
   * **Note:** This and `intRange()` are both defined because their respective
   * errors convey different information.
   *
   * @param {*} value Value to check.
   * @param {number} minInc Minimum acceptable value (inclusive).
   * @param {number} maxInc Maximum acceptable value (inclusive).
   * @returns {number} `value`.
   */
  static intRangeInc(value, minInc, maxInc) {
    if (   (typeof value !== 'number')
        || !Number.isSafeInteger(value)
        || (value < minInc)
        || (value > maxInc)) {
      return TypeError.badValue(value, 'int', `${minInc} <= value <= ${maxInc}`);
    }

    return value;
  }
}
