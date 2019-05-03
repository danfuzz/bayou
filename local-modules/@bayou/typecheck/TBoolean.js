// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Errors, UtilityClass } from '@bayou/util-core';

/**
 * Type checker for type `Boolean`.
 */
export class TBoolean extends UtilityClass {
  /**
   * Checks a value of type `Boolean`.
   *
   * @param {*} value The (alleged) boolean.
   * @returns {boolean} `value`, if it is indeed a boolean.
   */
  static check(value) {
    if (typeof value !== 'boolean') {
      throw Errors.badValue(value, Boolean);
    }

    return value;
  }
}
