// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import inspect from 'object-inspect';

import DeltaUtil from 'delta-util';

/**
 * Minimum acceptable timestamp. This is a moment in time toward the start of
 * 2008.
 */
const MIN_TIME_MSEC = 1200000000 * 1000;

/**
 * Throws an error indicating a bad value, including the expected type and
 * representation of the value.
 *
 * @param {*} value The bad value.
 * @param {string} typeName Name of the expected type.
 * @param {string|null} [extra = null] Extra info about the expected value.
 */
function badValue(value, typeName, extra = null) {
  const rep = inspect(value);

  extra = (extra === null) ? '' : `, ${extra}`;
  throw new Error(`Expected value of type \`${typeName}\`${extra}. Got \`${rep}\`.`);
}

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
   * Checks a value of type boolean.
   *
   * @param {*} value The (alleged) boolean.
   * @param {boolean|null} [defaultValue = null] Default value. If passed,
   *   indicates that `undefined` should be treated as that value. If not
   *   passed, `undefined` is an error.
   * @returns {boolean} `value` or `defaultValue`
   */
  static boolean(value, defaultValue = null) {
    if ((value === undefined) && (defaultValue !== null)) {
      value = defaultValue;
    }

    if (typeof value !== 'boolean') {
      return badValue(value, 'boolean');
    }

    return value;
  }

  /**
   * Checks a value of type `FrozenDelta`.
   *
   * @param {*} value Value to check.
   * @param {boolean} [coerce = false] If `true` and `value` can be coerced to
   *   a frozen delta, then do so instead of throwing an error.
   * @returns {FrozenDelta} `value` or its coercion.
   */
  static frozenDelta(value, coerce = false) {
    // It's more straightforward to always coerce and then check to see if
    // `result === value` when coercion isn't acceptable. And if you're
    // thinking, "Hey that's extra work!" well, we're going to be throwing an
    // error in that case anyway, which will totally dwarf the cost of the
    // superfluous coercion.
    let result;
    try {
      result = DeltaUtil.coerce(value);
    } catch (e) {
      return badValue(value, 'FrozenDelta');
    }

    if (!coerce && (value !== result)) {
      return badValue(value, 'FrozenDelta');
    }

    return result;
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
      return badValue(value, 'int', `value >= ${minInc}`);
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
      return badValue(value, 'int', `${minInc} <= value < ${maxExc}`);
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
      return badValue(value, 'int', `${minInc} <= value <= ${maxInc}`);
    }

    return value;
  }

  /**
   * Checks a value of type `object`, which must have exactly the indicated set
   * of keys.
   *
   * @param {*} value Value to check.
   * @param {Array<string>} keys Keys that must be present in `value`.
   * @returns {object} `value`.
   */
  static objectWithExactKeys(value, keys) {
    if (typeof value !== 'object') {
      return badValue(value, 'object');
    }

    // Make a copy, check for and delete allowed keys, and see if anything's
    // left.

    const copy = Object.assign({}, value);
    for (const k of keys) {
      if (!Object.hasOwnProperty(copy, k)) {
        return badValue(value, 'object', `Missing key \`${k}\``);
      }
      delete copy[k];
    }

    const remainingKeys = Object.keys(copy);
    if (remainingKeys.length !== 0) {
      let msg = 'Extra keys';
      for (const k of remainingKeys) {
        msg += ` \`${k}\``;
      }
      return badValue(value, 'object', msg);
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
      return badValue(value, 'timeMsec');
    }
  }

  /**
   * Checks a value of type string.
   *
   * @param {*} value Value to check.
   * @returns {string} `value`.
   */
  static string(value) {
    if (typeof value !== 'string') {
      return badValue(value, 'string');
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
      return badValue(value, 'stringOrNull');
    }

    return value;
  }

  /**
   * Checks a value of type `versionNumber`. Version numbers are non-negative
   * integers. In addition, in any given context there is generally an upper
   * limit on them.
   *
   * @param {*} value Value to check.
   * @param {number} [max] Maximum acceptable value (inclusive). If
   *   `undefined`, there is no upper limit.
   * @param {*} [ifAbsent] Default value. If passed and `value` is `undefined`,
   *   this method will return this value instead of throwing an error.
   * @returns {number} `value` or `ifAbsent`.
   */
  static versionNumber(value, max = undefined, ifAbsent = undefined) {
    if ((value === undefined) && (ifAbsent !== undefined)) {
      return ifAbsent;
    }

    if (   (typeof value !== 'number')
        || !Number.isSafeInteger(value)
        || (value < 0)) {
      return badValue(value, 'versionNumber');
    }

    if ((max !== undefined) && (value > max)) {
      return badValue(value, 'versionNumber', `value <= ${max}`);
    }

    return value;
  }
}
