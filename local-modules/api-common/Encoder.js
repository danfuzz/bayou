// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

/**
 * Main implementation of `Codec.encodeData()`.
 */
export default class Encoder extends CommonBase {
  /**
   * Construct an instance.
   *
   * @param {Registry} reg Registry instance to use.
   */
  constructor(reg) {
    super();

    /** {Registry} Registry instance to use. */
    this._reg = reg;

    /** {function} Handy pre-bound version of `encodeData()`. */
    this._encodeData = this.encodeData.bind(this);
  }

  /**
   * Main implementation of `Codec.encodeData()`, see which for details.
   *
   * @param {*} value Value to convert.
   * @returns {*} The converted value.
   */
  encodeData(value) {
    switch (typeof value) {
      case 'boolean':
      case 'number':
      case 'string': {
        // Pass through as-is.
        return value;
      }

      case 'object': {
        // Pass `null` through as-is, and attempt to encode anything else.
        return (value === null) ? null : this._encodeInstance(value);
      }

      default: {
        throw new Error(`API cannot encode type \`${typeof value}\`.`);
      }
    }
  }

  /**
   * Helper for `encodeData()` which validates and converts an object which is
   * expected (and verified) to be API-encodable.
   *
   * @param {object} value Value to convert.
   * @returns {object} The converted value.
   */
  _encodeInstance(value) {
    const itemCodec = this._reg.codecForValue(value);
    const payload   = itemCodec.encode(value, this._encodeData);

    if (Array.isArray(payload)) {
      // "Unshift" the item tag onto the encoded payload; that is, push on the
      // front.
      payload.unshift(itemCodec.tag);
    }

    // **Note:** If `payload` isn't an array, that means that its not in
    // "construction arguments" form. In that case its "tag" is implicit in the
    // type of the value.

    return Object.freeze(payload);
  }
}
