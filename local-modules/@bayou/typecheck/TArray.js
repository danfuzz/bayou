// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Errors, UtilityClass } from '@bayou/util-core';

/**
 * Type checker for type `Array`.
 */
export class TArray extends UtilityClass {
  /**
   * Checks a value of type `Array`. Optionally checks the type of each element.
   *
   * @param {*} value The (alleged) array.
   * @param {function|null} [elementCheck = null] Element type checker. If
   *   passed as non-`null`, must be a function that behaves like a standard
   *   `<type>.check()` method.
   * @returns {array} `value`.
   */
  static check(value, elementCheck = null) {
    if (!Array.isArray(value)) {
      throw Errors.badValue(value, Array);
    }

    if (elementCheck !== null) {
      // **Note:** `in` not `of` because we check named properties too.
      for (const k in value) {
        elementCheck(value[k]);
      }
    }

    return value;
  }
}
