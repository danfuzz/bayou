// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ObjectUtil } from 'util-common';

import TypeError from './TypeError';

/**
 * Minimum acceptable timestamp. This is a moment in time toward the start of
 * 2008.
 */
const MIN_TIME_MSEC = 1200000000 * 1000;

/**
 * Type checking and validation. This class consists of static methods which
 * take a value and (sometimes) additional options. The methods return a value
 * of a specific type or throw an error:
 *
 * * If the input value if it is already of the type in question, that value is
 *   returned.
 * * If the input value isn't of the type in question but the options allow for
 *   conversion or defaulting, then the return value is the converted /
 *   defaulted value.
 * * Otherwise, an error is thrown with a message typically of the form
 *   "Expected value of type <type>."
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
   * Checks a value of a given class.
   *
   * @param {*} value Value to check.
   * @param {object} clazz Class (constructor) that `value` must be an instance
   *   of.
   * @returns {object} `value`.
   */
  static instance(value, clazz) {
    if (!(value instanceof clazz)) {
      return TypeError.badValue(value, clazz.name);
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

  /**
   * Checks a value of type `object`.
   *
   * @param {*} value Value to check.
   * @returns {object} `value`.
   */
  static object(value) {
    if (typeof value !== 'object') {
      return TypeError.badValue(value, 'object');
    }

    return value;
  }

  /**
   * Checks a value of type `object`, which must have exactly the indicated set
   * of keys as "own" properties.
   *
   * @param {*} value Value to check.
   * @param {Array<string>} keys Keys that must be present in `value`.
   * @returns {object} `value`.
   */
  static objectWithExactKeys(value, keys) {
    if (typeof value !== 'object') {
      return TypeError.badValue(value, 'object');
    }

    // Make a copy, check for and delete allowed keys, and see if anything's
    // left.

    const copy = Object.assign({}, value);
    for (const k of keys) {
      if (!ObjectUtil.hasOwnProperty(copy, k)) {
        return TypeError.badValue(value, 'object', `Missing key \`${k}\``);
      }
      delete copy[k];
    }

    const remainingKeys = Object.keys(copy);
    if (remainingKeys.length !== 0) {
      let msg = 'Extra keys';
      for (const k of remainingKeys) {
        msg += ` \`${k}\``;
      }
      return TypeError.badValue(value, 'object', msg);
    }

    return value;
  }

  /**
   * Checks a value of type string.
   *
   * @param {*} value Value to check.
   * @returns {string} `value`.
   */
  static string(value) {
    if (typeof value !== 'string') {
      return TypeError.badValue(value, 'string');
    }

    return value;
  }

  /**
   * Checks a value of type string, which must furthermore have at least a
   * given number of characters.
   *
   * @param {*} value Value to check.
   * @param {number} minLen Minimum allowed length.
   * @returns {string} `value`.
   */
  static stringMinLen(value, minLen) {
    if ((typeof value !== 'string') || (value.length < minLen)) {
      return TypeError.badValue(value, 'string', `value.length >= ${minLen}`);
    }

    return value;
  }

  /**
   * Checks a value of type string, which must furthermore not be empty.
   *
   * @param {*} value Value to check.
   * @returns {string} `value`.
   */
  static stringNonempty(value) {
    if ((typeof value !== 'string') || (value === '')) {
      return TypeError.badValue(value, 'string', 'value !== \'\'');
    }

    return value;
  }

  /**
   * Checks a value of type string-or-null.
   *
   * @param {*} value Value to check.
   * @returns {string|null} `value`.
   */
  static stringOrNull(value) {
    if ((value !== null) && (typeof value !== 'string')) {
      return TypeError.badValue(value, 'stringOrNull');
    }

    return value;
  }

  /**
   * Checks a value of type `timeMsec`. These are integer counts of milliseconds
   * since the Unix Epoch, with a minimum value set to be around the start of
   * 2008.
   *
   * @param {*} value Value to check.
   * @returns {number} `value`.
   */
  static timeMsec(value) {
    try {
      return Typecheck.intMin(value, MIN_TIME_MSEC);
    } catch (e) {
      // More appropriate error.
      return TypeError.badValue(value, 'timeMsec');
    }
  }
}
