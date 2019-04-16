// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Errors from './Errors';
import UtilityClass from './UtilityClass';

/**
 * Utility to implement the minimal bits of typechecking required by this
 * module. This class exists to avoid a circular dependency between this module
 * and `@bayou/typecheck`.
 */
export default class CoreTypecheck extends UtilityClass {
  /**
   * Checks that a value is of type `string` and has the usual form of a
   * programming language identifier.
   *
   * @param {*} value Value to check.
   * @returns {string} `value`.
   */
  static checkIdentifier(value) {
    try {
      return CoreTypecheck.checkString(value, /^[_a-zA-Z][_a-zA-Z0-9]*$/);
    } catch (e) {
      // More accurate error.
      throw Errors.badValue(value, String, 'identifier syntax');
    }
  }

  /**
   * Checks that a value is of type `Int`. That is, it must be an integer (more
   * specifically a "safe integer") of JavaScript type `number`. In addition, it
   * optionally checks lower (inclusive) and upper (exclusive) bounds.
   *
   * @param {*} value Value to check.
   * @param {Int|null} [minInc = null] Minimum (inclusive) allowed value, or
   *   `null` if there is no minimum.
   * @param {Int|null} [maxExc = null] Maximum (exclusive) allowed value, or
   *   `null` if there is no maximum.
   * @returns {Int} `value`.
   */
  static checkInt(value, minInc = null, maxExc = null) {
    if (minInc !== null) {
      CoreTypecheck.checkInt(minInc);
    }

    if (maxExc !== null) {
      CoreTypecheck.checkInt(maxExc);
    }

    if (   (typeof value === 'number')
        && Number.isSafeInteger(value)
        && ((minInc === null) || (value >= minInc))
        && ((maxExc === null) || (value < maxExc))) {
      return value;
    }

    // It's an error, so figure out the details and throw.

    let msgArg;
    if (minInc !== null) {
      msgArg = [(maxExc === null) ? `value >= ${minInc}` : `${minInc} <= value < ${maxExc}`];
    } else if (maxExc !== null) {
      msgArg = [`value < ${maxExc}`];
    } else {
      msgArg = [];
    }

    throw Errors.badValue(value, 'Int', ...msgArg);
  }

  /**
   * Checks that a value is of type `string` and has the usual form of a
   * "label-like thing" in programming. This is the same as an identifier,
   * except that dashes and periods are allowed throughout.
   *
   * @param {*} value Value to check.
   * @returns {string} `value`.
   */
  static checkLabel(value) {
    try {
      return CoreTypecheck.checkString(value, /^[-._a-zA-Z][-._a-zA-Z0-9]*$/);
    } catch (e) {
      // More accurate error.
      throw Errors.badValue(value, String, 'label syntax');
    }
  }

  /**
   * Checks that a value is of type `object`, and is optionally an instance of
   * a particular class. `null` is _not_ considered an object by this check.
   * Functions _are_ considered objects by this check.
   *
   * @param {*} value Value to check.
   * @param {object|null} [clazz = null] Class (constructor) that `value` must
   *   be an instance of, or `null` if there is no class requirement.
   * @returns {object} `value`.
   */
  static checkObject(value, clazz = null) {
    if (clazz !== null) {
      if (!(value instanceof clazz)) {
        throw Errors.badValue(value, `class ${clazz.name}`);
      }
    } else if (value === null) {
      throw Errors.badValue(value, Object);
    } else {
      const type = typeof value;
      if ((type !== 'object') && (type !== 'function')) {
        throw Errors.badValue(value, Object);
      }
    }

    return value;
  }

  /**
   * Checks that a value is of type `string`.
   *
   * @param {*} value Value in question.
   * @param {RegExp|null} [regex = null] Regular expression to match against or
   *   `null` if no matching is required.
   * @returns {string} `value`.
   */
  static checkString(value, regex = null) {
    if ((regex !== null) && !(regex instanceof RegExp)) {
      throw Errors.badValue(regex, RegExp);
    }

    if (typeof value !== 'string') {
      throw Errors.badValue(value, String, (regex ? regex.toString() : null));
    }

    if ((regex !== null) && !regex.test(value)) {
      throw Errors.badValue(value, String, regex.toString());
    }

    return value;
  }

  /**
   * Checks that a value is either of type `string` or is `null`.
   *
   * @param {*} value Value in question.
   * @returns {string|null} `value`.
   */
  static checkStringOrNull(value) {
    if ((value !== null) && (typeof value !== 'string')) {
      throw Errors.badValue(value, 'String|null');
    }

    return value;
  }
}
