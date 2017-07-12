// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

/**
 * Main implementation of `Codec.decodeData()`.
 */
export default class Decoder extends CommonBase {
  /**
   * Construct an instance.
   *
   * @param {Registry} reg Registry instance to use.
   */
  constructor(reg) {
    super();

    /** {Registry} Registry instance to use. */
    this._reg = reg;
  }

  /**
   * Main implementation of `Codec.decodeData()`, see which for details.
   *
   * @param {*} value Value to convert.
   * @returns {*} The converted value.
   */
  decodeData(value) {
    const type = typeof value;

    if (type === 'function') {
      throw new Error(`API cannot decode functions.`);
    } else if ((type !== 'object') || (value === null)) {
      // Pass through as-is.
      return value;
    } else if (Object.getPrototypeOf(value) === Object.prototype) {
      return this._decodeSimpleObject(value);
    } else if (!Array.isArray(value)) {
      throw new Error(`API cannot decode object of class \`${value.constructor.name}\`.`);
    } else {
      return this._decodeInstance(value);
    }
  }

  /**
   * Helper for `decodeData()` which validates and converts a simple object.
   *
   * @param {object} encoded The encoded value.
   * @returns {object} The decoded value.
   */
  _decodeSimpleObject(encoded) {
    const result = {};

    for (const k in encoded) {
      result[k] = this.decodeData(encoded[k]);
    }

    return Object.freeze(result);
  }

  /**
   * Helper for `decodeData()` which validates and converts a tagged
   * constructor array. These are used as the encoded form of both arrays per se
   * and arbitrary class instances.
   *
   * **Note:** Array results are handled by virtue of the fact that
   * `SpecialCodecs.ARRAY` will have been registered as an item codec.
   *
   * @param {array<*>} encoded The encoded value.
   * @returns {object} The decoded value.
   */
  _decodeInstance(encoded) {
    const tag     = encoded[0];
    const payload = encoded.slice(1);

    // It's an error if the array doesn't start with a string tag (even for
    // a value that decodes to an array per se), so check for that.
    if (typeof tag !== 'string') {
      if (encoded.length === 0) {
        throw new Error('API cannot decode empty arrays.');
      } else {
        throw new Error('API cannot decode arrays without an initial string tag.');
      }
    }

    const itemCodec = this._reg.codecForTag(tag);
    const decodedPayload =
      Object.freeze(payload.map(this.decodeData.bind(this)));

    return itemCodec.decode(decodedPayload);
  }
}
