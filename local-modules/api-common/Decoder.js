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

    /** {function} Handy pre-bound version of `decodeData()`. */
    this._decodeData = this.decodeData.bind(this);
  }

  /**
   * Main implementation of `Codec.decodeData()`, see which for details.
   *
   * @param {*} payload Payload to decode.
   * @returns {*} The decoded value.
   */
  decodeData(payload) {
    const type = typeof payload;

    if (type === 'function') {
      throw new Error(`API cannot decode functions.`);
    } else if ((type !== 'object') || (payload === null)) {
      // Pass through as-is.
      return payload;
    } else {
      const itemCodec = this._reg.codecForPayload(payload);
      return itemCodec.decode(payload, this._decodeData);
    }
  }
}
