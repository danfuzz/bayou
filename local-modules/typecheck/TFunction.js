// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import TypeError from './TypeError';

/**
 * Type checker for type `Function`.
 */
export default class TFunction {
  /**
   * Checks a value of type `Function`.
   *
   * @param {*} value The (alleged) function.
   * @returns {Function} `value`.
   */
  static check(value) {
    if (typeof value !== 'function') {
      return TypeError.badValue(value, 'Function');
    }

    return value;
  }
}
