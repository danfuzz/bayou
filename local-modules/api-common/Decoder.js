// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { UtilityClass } from 'util-common';

import Registry from './Registry';

/**
 * Main implementation of `Codec.decode()`.
 *
 * **TODO:** If and when `Registry` stops being a singleton, this class should
 * correspondingly stop being a utility class, since it will no longer be the
 * case that there is a unique registry to query.
 */
export default class Decoder extends UtilityClass {
  /**
   * Main implementation of `Codec.decode()`, see which for details.
   *
   * @param {*} value Value to convert.
   * @returns {*} The converted value.
   */
  static decode(value) {
    const type = typeof value;

    if (type === 'function') {
      throw new Error(`API cannot decode functions.`);
    } else if ((type !== 'object') || (value === null)) {
      // Pass through as-is.
      return value;
    } else if (Object.getPrototypeOf(value) === Object.prototype) {
      return Decoder._decodeSimpleObject(value);
    } else if (!Array.isArray(value)) {
      throw new Error(`API cannot decode object of class \`${value.constructor.name}\`.`);
    }

    // We know it's an array.

    if (value.length === 0) {
      throw new Error('API cannot decode empty arrays.');
    }

    const tag = value[0];
    const payload = value.slice(1);

    if (tag === Registry.ARRAY_TAG) {
      return Decoder._decodeArray(payload);
    } else if (typeof tag !== 'string') {
      throw new Error('API cannot decode arrays without an initial string tag.');
    } else {
      // It had better be a registered tag, but if not, then this call will
      // throw.
      return Decoder._decodeInstance(tag, payload);
    }
  }

  /**
   * Helper for `decode()` which validates and converts a simple object.
   *
   * @param {object} value Value to convert.
   * @returns {object} The converted value.
   */
  static _decodeSimpleObject(value) {
    const result = {};

    for (const k in value) {
      result[k] = Decoder.decode(value[k]);
    }

    return Object.freeze(result);
  }

  /**
   * Helper for `decode()` which validates and converts a regular array
   * (which was originally tagged with `array`).
   *
   * @param {array} payload Value to convert.
   * @returns {array} The converted value.
   */
  static _decodeArray(payload) {
    const result = payload.map(Decoder.decode);
    return Object.freeze(result);
  }

  /**
   * Helper for `decode()` which validates and converts a tagged
   * constructor array.
   *
   * @param {string} tag Name tag.
   * @param {array} payload Construction arguments.
   * @returns {object} The converted value.
   */
  static _decodeInstance(tag, payload) {
    const clazz = Registry.theOne.find(tag);
    const args = Decoder._decodeArray(payload);

    if (!clazz) {
      throw new Error(`API cannot decode object of class \`${tag}\`.`);
    }

    return clazz.fromApi(...args);
  }
}
