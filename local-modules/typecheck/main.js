// Copyright 2016 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import inspect from 'object-inspect';

import DeltaUtil from 'delta-util';

/**
 * Throws an error indicating a bad value, including the expected type and
 * representation of the value.
 *
 * @param value The bad value.
 * @param typeName Name of the expected type.
 * @param extra Extra info about the expected value.
 */
function badValue(value, typeName, extra = undefined) {
  const rep = inspect(value);

  extra = (extra === undefined) ? '' : `, ${extra}`;
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
   * Checks a value of type `FrozenDelta`.
   *
   * @param value Value to check.
   * @param coerce (default `false`) If `true` and `value` can be coerced to
   * a frozen delta, then do so instead of throwing an error.
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
   * @param value Value to check.
   * @param minInc Minimum acceptable value (inclusive).
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
   * @param value Value to check.
   * @param minInc Minimum acceptable value (inclusive).
   * @param maxExc Maximum acceptable value (exclusive).
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
   * @param value Value to check.
   * @param minInc Minimum acceptable value (inclusive).
   * @param maxInc Maximum acceptable value (inclusive).
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
   * Checks a value of type `versionNumber`. Version numbers are non-negative
   * integers. In addition, in any given context there is generally an upper
   * limit on them.
   *
   * @param value Value to check.
   * @param max Maximum acceptable value (inclusive).
   * @param ifAbsent (optional) Default value. If passed and `value` is
   * `undefined`, this method will return this value instead of throwing an
   * error.
   */
  static versionNumber(value, max, ifAbsent = undefined) {
    if ((value === undefined) && (ifAbsent !== undefined)) {
      return ifAbsent;
    }

    if (   (typeof value !== 'number')
        || !Number.isSafeInteger(value)
        || (value < 0)) {
      return badValue(value, 'versionNumber');
    }

    if (value > max) {
      return badValue(value, 'versionNumber', `value <= ${max}`);
    }

    return value;
  }
}
