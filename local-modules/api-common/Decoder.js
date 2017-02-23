// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Registry from './Registry';

/**
 * Decoding of values that had been transpored over the API (or were read in
 * from disk or databases).
 */
export default class Decoder {
  /**
   * Converts JSON-encoded text to a usable value. See `decode()` for
   * details.
   *
   * @param {string} json Text to convert.
   * @returns {*} The converted value.
   */
  static decodeJson(json) {
    return Decoder.decode(JSON.parse(json));
  }

  /**
   * Converts a value that was previously converted with `Encoder.encode()` (or
   * the equivalent) back into fully useful objects. Specifically:
   *
   * * Non-object values are passed through as-is.
   * * `null` is passed through as-is.
   * * Direct instances of `Object` (`x` such that `Object.getPrototypeOf(x) ===
   *   Object.prototype`) are allowed, with their values processed recursively
   *   using (the equivalent of) this method.
   * * Arrays whose first element is not a string (including empty arrays) are
   *   rejected.
   * * Other arrays are processed recursively using (the equivalent of) this
   *   method, without the first element. If the first element is the value
   *   `Registry.ARRAY_TAG` then the processed form is used as-is. Otherwise,
   *   the first element is used to look up a class that has been registered
   *   under that name. Its `fromApi()` method is called, passing the converted
   *   array as arguments. The result of that call becomes the result of
   *   conversion.
   * * All other objects are rejected.
   *
   * In addition, if the result is an object (including an array), it is
   * guaranteed to be recursively frozen.
   *
   * @param {*} value Value to convert.
   * @returns {*} The converted value.
   */
  static decode(value) {
    if ((typeof value !== 'object') || (value === null)) {
      // Pass through as-is.
      return value;
    } else if (Object.getPrototypeOf(value) === Object.prototype) {
      return Decoder._simpleObjectFromApi(value);
    } else if (!Array.isArray(value)) {
      throw new Error(`API cannot receive object of class \`${value.constructor.name}\`.`);
    }

    // We know it's an array.

    if (value.length === 0) {
      throw new Error('API cannot receive empty arrays.');
    }

    const tag = value[0];
    const payload = value.slice(1);

    if (tag === Registry.ARRAY_TAG) {
      return Decoder._arrayFromApi(payload);
    } else if (typeof tag !== 'string') {
      throw new Error('API cannot receive arrays without an initial string tag.');
    } else {
      // It had better be a registered tag, but if not, then this call will
      // throw.
      return Decoder._instanceFromApi(tag, payload);
    }
  }

  /**
   * Helper for `decode()` which validates and converts a simple object.
   *
   * @param {object} value Value to convert.
   * @returns {object} The converted value.
   */
  static _simpleObjectFromApi(value) {
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
  static _arrayFromApi(payload) {
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
  static _instanceFromApi(tag, payload) {
    const clazz = Registry.find(tag);
    const args = Decoder._arrayFromApi(payload);

    if (!clazz) {
      throw new Error(`API cannot receive object of class \`${tag}\`.`);
    }

    return clazz.fromApi(...args);
  }
}
