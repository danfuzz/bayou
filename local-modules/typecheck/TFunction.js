// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { UtilityClass } from 'util-common-base';

import TypeError from './TypeError';

/**
 * Type checker for type `function`.
 */
export default class TFunction extends UtilityClass {
  /**
   * Checks a value of type `Function`.
   *
   * @param {*} value The (alleged) function.
   * @returns {function} `value`.
   */
  static check(value) {
    if (typeof value !== 'function') {
      return TypeError.badValue(value, 'function');
    }

    return value;
  }

  /**
   * Checks a value which must either be of type `Function` or the exact value
   * `null`.
   *
   * @param {*} value Value to check.
   * @returns {function|null} `value`.
   */
  static orNull(value) {
    if ((value !== null) && (typeof value !== 'function')) {
      return TypeError.badValue(value, 'function|null');
    }

    return value;
  }
}
