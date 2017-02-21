// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import TypeError from './TypeError';

/**
 * Type checker for type `String`.
 */
export default class TString {
  /**
   * Checks a value of type `String`.
   *
   * @param {*} value Value to check.
   * @returns {string} `value`.
   */
  static check(value) {
    if (typeof value !== 'string') {
      return TypeError.badValue(value, 'String');
    }

    return value;
  }

  /**
   * Checks a value of type `String`, which must furthermore have at least a
   * given number of characters.
   *
   * @param {*} value Value to check.
   * @param {number} minLen Minimum allowed length.
   * @returns {string} `value`.
   */
  static minLen(value, minLen) {
    if ((typeof value !== 'string') || (value.length < minLen)) {
      return TypeError.badValue(value, 'String', `value.length >= ${minLen}`);
    }

    return value;
  }

  /**
   * Checks a value of type `String`, which must furthermore not be empty.
   *
   * @param {*} value Value to check.
   * @returns {string} `value`.
   */
  static nonempty(value) {
    if ((typeof value !== 'string') || (value === '')) {
      return TypeError.badValue(value, 'String', 'value !== \'\'');
    }

    return value;
  }

  /**
   * Checks a value which must either be of type `String` or the exact value
   * `null`.
   *
   * @param {*} value Value to check.
   * @returns {string|null} `value`.
   */
  static orNull(value) {
    if ((value !== null) && (typeof value !== 'string')) {
      return TypeError.badValue(value, 'String|null');
    }

    return value;
  }
}
