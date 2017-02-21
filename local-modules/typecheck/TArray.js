// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import TypeError from './TypeError';

/**
 * Type checker for type `Array`.
 */
export default class TArray {
  /**
   * Checks a value of type `Array`.
   *
   * @param {*} value The (alleged) array.
   * @returns {array} `value`.
   */
  static check(value) {
    if (!Array.isArray(value)) {
      return TypeError.badValue(value, 'Array');
    }

    return value;
  }
}
