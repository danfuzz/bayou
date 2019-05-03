// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Errors, UtilityClass } from '@bayou/util-core';

/**
 * Type checker for type `Buffer`.
 *
 * **Note:** Babel's browser polyfill includes a Node-compatible `Buffer`
 * implementation, which is why this class works regardless of environment.
 */
export class TBuffer extends UtilityClass {
  /**
   * Checks a value of type `Buffer`.
   *
   * @param {*} value The (alleged) `Buffer`.
   * @returns {Buffer} `value`.
   */
  static check(value) {
    if (!Buffer.isBuffer(value)) {
      throw Errors.badValue(value, Buffer);
    }

    return value;
  }

  /**
   * Checks a value which must either be of type `Buffer` or the exact value
   * `null`.
   *
   * @param {*} value Value to check.
   * @returns {Buffer|null} `value`.
   */
  static orNull(value) {
    if (value === null) {
      return null;
    } else if (!Buffer.isBuffer(value)) {
      throw Errors.badValue(value, 'Buffer|null');
    }

    return value;
  }
}
