// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Errors, UtilityClass } from '@bayou/util-core';

/**
 * Type checker for type `Set`.
 */
export class TSet extends UtilityClass {
  /**
   * Checks a value of type `Set`. Optionally checks the types of values.
   *
   * @param {*} value The (alleged) `Set`.
   * @param {Function} [valueCheck = null] Value type checker. If passed as,
   *   non-`null`, must be a function that behaves like a standard
   *   `<type>.check()` method.
   * @returns {Set} `value`.
   */
  static check(value, valueCheck = null) {
    if (!(value instanceof Set)) {
      throw Errors.badValue(value, Set);
    }

    if (valueCheck !== null) {
      for (const v of value) {
        valueCheck(v);
      }
    }

    return value;
  }
}
