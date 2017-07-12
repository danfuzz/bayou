// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { UtilityClass } from 'util-common';

import ItemCodec from './ItemCodec';

/**
 * Utility class which holds special `ItemCodec`s (that is, ones that aren't
 * straightforward coders for class instances).
 */
export default class SpecialCodecs extends UtilityClass {
  /** {ItemCodec} Codec used for coding arrays. */
  static get ARRAY() {
    return new ItemCodec('array', Array, this.arrayPredicate,
      this.arrayEncode, this.arrayDecode);
  }

  /**
   * Decodes an array.
   *
   * @param {array<*>} payload Construction payload as previously produced by
   *   `arrayEncode()`.
   * @returns {array<*>} Decoded array.
   */
  static arrayDecode(payload) {
    // The array payload is self-representative. Easy!
    return payload;
  }

  /**
   * Encodes an array.
   *
   * @param {array<*>} value Array to encode.
   * @returns {array<*>} Encoded form.
   */
  static arrayEncode(value) {
    // Because of how the calling code operates, we know that by the time we get
    // here, `value` has passed `arrayPredicate()`. This means that all we have
    // to do is return the `value` itself. The one twist is that the coding
    // logic may want to alter the return value, so we can't return the same
    // exact object; but we _can_ just return a simple shallow copy.
    return value.slice();
  }

  /**
   * Checks an array for encodability.
   *
   * @param {array<*>} value Array to encode.
   * @returns {boolean} `true` iff `value` can be encoded.
   */
  static arrayPredicate(value) {
    // Check for `undefined` in the indexed properties. If we find one, then
    // either it's an explicit `undefined` or it's a hole; in either case, the
    // array is not encodable.
    for (const e of value) {
      if (e === undefined) {
        return false;
      }
    }

    // Since we know there are no holes (per above), the only way we could have
    // a different number of keys than the array `length` is if there are
    // additional named (non-indexed) properties. If this is the case, then the
    // array is not encodable.
    if (value.length !== Object.keys(value).length) {
      return false;
    }

    return true;
  }
}
