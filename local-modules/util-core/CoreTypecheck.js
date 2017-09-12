// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Errors from './Errors';
import UtilityClass from './UtilityClass';

/**
 * Utility to implement the minimal bits of typechecking required by this
 * module. This class exists to avoid a circular dependency between this module
 * and `typecheck`.
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
      return CoreTypecheck.checkString(value, /^[a-zA-Z_][a-zA-Z_0-9]*$/);
    } catch (e) {
      // More accurate error.
      throw Errors.bad_value(value, String, 'identifier syntax');
    }
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
      throw Errors.bad_value(regex, RegExp);
    }

    if (typeof value !== 'string') {
      throw Errors.bad_value(value, String, (regex ? regex.toString() : null));
    }

    if ((regex !== null) && !regex.test(value)) {
      throw Errors.bad_value(value, String, regex.toString());
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
      throw Errors.bad_value(value, 'String|null');
    }

    return value;
  }
}
