// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TBuffer } from 'typecheck';
import { UtilityClass } from 'util-common-base';

/**
 * `Buffer` helper utilities.
 */
export default class BufferUtil extends UtilityClass {
  /**
   * Converts a `Buffer` to an array of its bytes.
   *
   * @param {Buffer} value `Buffer` to convert.
   * @returns {array<Int>} The converted result.
   */
  static toArray(value) {
    // The instance method `Array.slice()` is guaranteed to work on `Buffer`
    // instances, but it's kinda awkward to call!
    return Array.prototype.slice.call(TBuffer.check(value));
  }
}
