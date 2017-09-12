// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import UtilityClass from './UtilityClass';

/**
 * Utility to implement the minimal bits of typechecking required by this
 * module. This class exists to avoid a circular dependency between this module
 * and `typecheck`.
 */
export default class Types extends UtilityClass {
  /**
   * Checks that a value is of type `string` and has the usual form of a
   * programming language identifier.
   *
   * @param {*} value Value to check.
   * @returns {string} `value`.
   */
  static checkIdentifier(value) {
    // **TODO:** Factor this regex out, so it's not duplicative with the same
    // one in `typecheck.TString`.
    return Types.checkString(value, /^[a-zA-Z_][a-zA-Z_0-9]*$/);
  }

  /**
   * Checks that a value is of type `string`.
   *
   * @param {*} value Value in question.
   * @param {RegExp} [regex = null] Regular expression to match against or
   *   `null` if no matching is required.
   * @returns {string} `value`.
   */
  static checkString(value, regex = null) {
    if (typeof value !== 'string') {
      throw new Error('Expected a string.');
    }

    if ((regex !== null) && !regex.test(value)) {
      throw new Error('Did not match regex.');
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
      throw new Error('Expected a string or `null`.');
    }

    return value;
  }
}
