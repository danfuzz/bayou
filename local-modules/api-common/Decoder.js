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

    /** {static} Conveniently cached value of `reg.arrayTag`. */
    this._arrayTag = reg.arrayTag;
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

    // We know it's an array.

    if (value.length === 0) {
      throw new Error('API cannot decode empty arrays.');
    }

    const tag = value[0];
    const payload = value.slice(1);

    if (tag === this._arrayTag) {
      return this._decodeArray(payload);
    } else if (typeof tag !== 'string') {
      throw new Error('API cannot decode arrays without an initial string tag.');
    } else {
      // It had better be a registered tag, but if not, then this call will
      // throw.
      return this._decodeInstance(tag, payload);
    }
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
   * Helper for `decodeData()` which validates and converts a regular array
   * (which was originally tagged with `array`).
   *
   * @param {array} payload Value to convert.
   * @returns {array} The converted value.
   */
  _decodeArray(payload) {
    const result = payload.map(this.decodeData.bind(this));
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
    const clazz = this._reg.classForName(tag);
    const args = this._decodeArray(payload);

    if (!clazz) {
      throw new Error(`API cannot decode object of class \`${tag}\`.`);
    }

    return clazz.fromApi(...args);
  }
}
