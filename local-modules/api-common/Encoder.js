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
        const itemCodec = this._reg.codecForValue(value);
        return itemCodec.encode(value, this._encodeData);
      }

      default: {
        throw new Error(`API cannot encode type \`${typeof value}\`.`);
      }
    }
  }
}
