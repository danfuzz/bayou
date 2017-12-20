// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Errors, UtilityClass } from 'util-core';

/**
 * Type checker for type `Buffer`.
 *
 * **Note:** Babel's browser polyfill includes a Node-compatible `Buffer`
 * implementation, which is why this class works regardless of environment.
 */
export default class TBuffer extends UtilityClass {
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
}
