// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Errors, UtilityClass } from '@bayou/util-core';

/**
 * Type checker for type `Map`.
 */
export class TMap extends UtilityClass {
  /**
   * Checks a value of type `Map`. Optionally checks the types of keys and
   *  values.
   *
   * @param {*} value The (alleged) `Map`.
   * @param {Function} [keyCheck = null] Key type checker. If passed as
   *   non-`null`, must be a function that behaves like a standard
   *   `<type>.check()` method.
   * @param {Function} [valueCheck = null] Value type checker. If passed as,
   *   non-`null`, must be a function that behaves like a standard
   *   `<type>.check()` method.
   * @returns {Map} `value`.
   */
  static check(value, keyCheck = null, valueCheck = null) {
    if (!(value instanceof Map)) {
      throw Errors.badValue(value, Map);
    }

    if ((keyCheck !== null) || (valueCheck !== null)) {
      for (const [k, v] of value) {
        if (keyCheck !== null) {
          keyCheck(k);
        }
        if (valueCheck !== null) {
          valueCheck(v);
        }
      }
    }

    return value;
  }
}
