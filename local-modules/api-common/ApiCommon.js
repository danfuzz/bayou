// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Registry from './Registry';

/**
 * Common functionality for both client and server sides of the API subsystem.
 */
export default class ApiCommon {
  /**
   * Converts an arbitrary value to JSON-encoded text. See `apiFromValue()` for
   * details.
   *
   * @param {*} value Value to convert.
   * @returns {string} The converted value.
   */
  static jsonFromValue(value) {
    return JSON.stringify(ApiCommon.apiFromValue(value));
  }

  /**
   * Converts JSON-encoded text to a usable value. See `valueFromApi()` for
   * details.
   *
   * @param {string} json Text to convert.
   * @returns {*} The converted value.
   */
  static valueFromJson(json) {
    return ApiCommon.valueFromApi(JSON.parse(json));
  }

  /**
   * Converts an arbitrary value to a form suitable for JSON-encoding and
   * subsequent transfer over the API. In some cases, it rejects values.
   * Specifically:
   *
   * * Functions are rejected.
   * * Symbols are rejected.
   * * `undefined` is rejected.
   * * Other non-object values are passed through as-is.
   * * `null` is passed through as-is.
   * * Direct instances of `Object` (`x` such that `Object.getPrototypeOf(x) ===
   *   Object.prototype`) are allowed, with their values processed recursively
   *   using (the equivalent of) this method.
   * * Arrays with holes (unset value of `x[n]` for `n < x.length`) are
   *   rejected.
   * * Arrays with non-numeric properties are rejected.
   * * Other arrays are allowed, with their values processed recursively using
   *   (the equivalent of) this method. The encoded form is also an array but
   *   with an additional first element of the value `Registry.ARRAY_TAG`.
   * * Objects which bind a method `toApi()` and whose constructor binds a
   *   property `API_NAME` are allowed. Such objects will have `toApi()` called
   *   on them, which is expected to result in an array which is suitable for
   *   processing using (the equivalent of) this method. The encoded form is an
   *   array with the first element the value of `API_NAME` and the rest of the
   *   elements whatever was returned by `toApi()`.
   * * All other objects are rejected.
   *
   * In addition, if the result is an object (including an array), it is
   * guaranteed to be recursively frozen.
   *
   * @param {*} value Value to convert.
   * @returns {*} The converted value.
   */
  static apiFromValue(value) {
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
        } else if (Object.getPrototypeOf(value) === Object.prototype) {
          return ApiCommon._apiFromSimpleObject(value);
        } else if (Array.isArray(value)) {
          return ApiCommon._apiFromArray(value);
        } else {
          // It had better define the API metainfo properties, but if not, then
          // this call will throw.
          return ApiCommon._apiFromInstance(value);
        }
      }

      default: {
        throw new Error(`API cannot transmit type \`${typeof value}\`.`);
      }
    }
  }

  /**
   * Helper for `apiFromValue()` which validates and converts a simple object.
   *
   * @param {object} value Value to convert.
   * @returns {object} The converted value.
   */
  static _apiFromSimpleObject(value) {
    const result = {};

    for (const k in value) {
      result[k] = ApiCommon.apiFromValue(value[k]);
    }

    return Object.freeze(result);
  }

  /**
   * Helper for `apiFromValue()` which validates and converts an array.
   *
   * @param {array} value Value to convert.
   * @param {string} [tag = Registry.ARRAY_TAG] "Header" tag for the result.
   * @returns {array} The converted value.
   */
  static _apiFromArray(value, tag = Registry.ARRAY_TAG) {
    // Convert elements and keep a count of how many elements we encounter.
    let count = 0;
    const result = value.map((elem) => {
      count++;
      return ApiCommon.apiFromValue(elem);
    });

    if (value.length !== count) {
      // `Array.map()` skips holes, so a `length` / `count` mismatch
      // occurs iff there is a hole.
      throw new Error('API cannot transmit arrays with holes.');
    } else if (value.length !== Object.keys(value).length) {
      // Since we know there are no holes (per above), the only way we
      // could have a different number of keys than the array `length` is
      // if there are additional named properties.
      throw new Error('API cannot transmit arrays with named properties.');
    }

    result.unshift(tag); // The specified "header" tag value.
    return Object.freeze(result);
  }

  /**
   * Helper for `apiFromValue()` which validates and converts an object which is
   * expected (and verified) to have API metainfo properties.
   *
   * @param {object} value Value to convert.
   * @returns {object} The converted value.
   */
  static _apiFromInstance(value) {
    const apiName = value.constructor && value.constructor.API_NAME;
    const toApi = value.toApi;

    if ((typeof apiName !== 'string') || (typeof toApi !== 'function')) {
      throw new Error(`API cannot transmit object of class \`${value.constructor.name}\`.`);
    }

    const payload = value.toApi();
    if (!Array.isArray(payload)) {
      throw new Error(`Non-array result from \`toApi()\` on class \`${value.constructor.name}\`.`);
    }

    return ApiCommon._apiFromArray(payload, apiName);
  }

  /**
   * Converts a value that was previously converted with `valueToApi()` (or the
   * equivalent) back into fully useful objects. Specifically:
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
  static valueFromApi(value) {
    if ((typeof value !== 'object') || (value === null)) {
      // Pass through as-is.
      return value;
    } else if (Object.getPrototypeOf(value) === Object.prototype) {
      return ApiCommon._simpleObjectFromApi(value);
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
      return ApiCommon._arrayFromApi(payload);
    } else if (typeof tag !== 'string') {
      throw new Error('API cannot receive arrays without an initial string tag.');
    } else {
      // It had better be a registered tag, but if not, then this call will
      // throw.
      return ApiCommon._instanceFromApi(tag, payload);
    }
  }

  /**
   * Helper for `valueFromApi()` which validates and converts a simple object.
   *
   * @param {object} value Value to convert.
   * @returns {object} The converted value.
   */
  static _simpleObjectFromApi(value) {
    const result = {};

    for (const k in value) {
      result[k] = ApiCommon.valueFromApi(value[k]);
    }

    return Object.freeze(result);
  }

  /**
   * Helper for `valueFromApi()` which validates and converts a regular array
   * (which was originally tagged with `array`).
   *
   * @param {array} payload Value to convert.
   * @returns {array} The converted value.
   */
  static _arrayFromApi(payload) {
    const result = payload.map(ApiCommon.valueFromApi);
    return Object.freeze(result);
  }

  /**
   * Helper for `valueFromApi()` which validates and converts a tagged
   * constructor array.
   *
   * @param {string} tag Name tag.
   * @param {array} payload Construction arguments.
   * @returns {object} The converted value.
   */
  static _instanceFromApi(tag, payload) {
    const clazz = Registry.find(tag);
    const args = ApiCommon._arrayFromApi(payload);

    if (!clazz) {
      throw new Error(`API cannot receive object of class \`${tag}\`.`);
    }

    return clazz.fromApi(...args);
  }
}
