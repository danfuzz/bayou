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
    }

    // We know it's encoded as an array, which means it's going to decode either
    // to an array per se or to an arbitrary value via a registered item codec.
    // Note that array results are handled by virtue of the fact that
    // `SpecialCodecs.ARRAY` will have been registered as an item codec.

    const tag = value[0];
    const payload = value.slice(1);

    // ...except that it's an error if the array doesn't start with a string
    // tag, so check for that.
    if (typeof tag !== 'string') {
      if (value.length === 0) {
        throw new Error('API cannot decode empty arrays.');
      } else {
        throw new Error('API cannot decode arrays without an initial string tag.');
      }
    }

    return this._decodeInstance(tag, payload);
  }

  /**
   * Helper for `decodeData()` which validates and converts a simple object.
   *
   * @param {object} value Value to convert.
   * @returns {object} The converted value.
   */
  _decodeSimpleObject(value) {
    const result = {};

    for (const k in value) {
      result[k] = this.decodeData(value[k]);
    }

    return Object.freeze(result);
  }

  /**
   * Helper for `decodeData()` which validates and converts a tagged
   * constructor array.
   *
   * @param {string} tag Name tag.
   * @param {array} payload Construction arguments.
   * @returns {object} The converted value.
   */
  _decodeInstance(tag, payload) {
    const itemCodec = this._reg.codecForTag(tag);
    const decodedPayload =
      Object.freeze(payload.map(this.decodeData.bind(this)));

    return itemCodec.decode(decodedPayload);
  }
}
