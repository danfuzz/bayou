// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase, ObjectUtil } from 'util-common';

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
        if (value === null) {
          // Pass through as-is.
          return value;
        }

        const proto = Object.getPrototypeOf(value);

        if (proto === Object.prototype) {
          return this._encodeSimpleObject(value);
        } else {
          // It had better be a value whose class/type is registered, but if
          // not, then this call will throw.
          return this._encodeInstance(value);
        }
      }

      default: {
        throw new Error(`API cannot encode type \`${typeof value}\`.`);
      }
    }
  }

  /**
   * Helper for `encodeData()` which validates and converts a simple object.
   *
   * @param {object} value Value to convert.
   * @returns {object} The converted value.
   */
  _encodeSimpleObject(value) {
    const result = {};

    for (const k of Object.getOwnPropertyNames(value)) {
      const prop = Object.getOwnPropertyDescriptor(value, k);
      const origValue = prop.value;

      if (origValue === undefined) {
        // `undefined` isn't encodable, but also this is what we'll see if
        // `k` names a synthetic property. The following differentiates the two
        // cases, for a maximum-fidelity error message.
        if (ObjectUtil.hasOwnProperty(prop, 'value')) {
          throw new Error('API cannot encode `undefined`.');
        } else {
          throw new Error('API cannot encode plain object with synthetic property.');
        }
      }

      result[k] = this.encodeData(origValue);
    }

    return Object.freeze(result);
  }

  /**
   * Helper for `encodeData()` which validates and converts an object which is
   * expected (and verified) to be API-encodable.
   *
   * @param {object} value Value to convert.
   * @returns {object} The converted value.
   */
  _encodeInstance(value) {
    const itemCodec      = this._reg.codecForValue(value);
    const payload        = itemCodec.encode(value);
    const encodedPayload = payload.map(this.encodeData.bind(this));

    // "Unshift" the item tag onto the encoded payload; that is, push on the
    // front.
    encodedPayload.unshift(itemCodec.tag);

    return Object.freeze(encodedPayload);
  }
}
