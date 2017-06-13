// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ObjectUtil, UtilityClass } from 'util-common';

import Registry from './Registry';

/**
 * Encoding of values for transport over the API (or for storage on disk or in
 * databases).
 *
 * **TODO:** If and when `Registry` stops being a singleton, this class should
 * correspondingly stop being a utility class, since it will no longer be the
 * case that there is a unique registry to query.
 */
export default class Encoder extends UtilityClass {
  /**
   * Converts an arbitrary value to JSON-encoded text. See `encode()` for
   * details.
   *
   * @param {*} value Value to convert.
   * @param {boolean} [pretty = false] Whether to "pretty-print" (indent and
   *   space for human consumption) the result.
   * @returns {string} The converted value.
   */
  static encodeJson(value, pretty = false) {
    return JSON.stringify(Encoder.encode(value), null, pretty ? 2 : 0);
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
  static encode(value) {
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
          return Encoder._encodeSimpleObject(value);
        } else if (proto === Array.prototype) {
          // Note: We don't use `Array.isArray()` because that will return
          // `true` for subclasses of Array. We want to instead treat Array
          // subclass instances as regular object instances (in the next
          // clause), so as not to miss out on their API metadata (or so as to
          // fail to encode them if they aren't in fact API-ready).
          return Encoder._encodeArray(value);
        } else {
          // It had better define the API metainfo properties, but if not, then
          // this call will throw.
          return Encoder._encodeInstance(value);
        }
      }

      default: {
        throw new Error(`API cannot encode type \`${typeof value}\`.`);
      }
    }
  }

  /**
   * Helper for `encode()` which validates and converts a simple object.
   *
   * @param {object} value Value to convert.
   * @returns {object} The converted value.
   */
  static _encodeSimpleObject(value) {
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

      result[k] = Encoder.encode(origValue);
    }

    return Object.freeze(result);
  }

  /**
   * Helper for `encode()` which validates and converts an array.
   *
   * @param {array} value Value to convert.
   * @param {string} [tag = Registry.ARRAY_TAG] "Header" tag for the result.
   * @returns {array} The converted value.
   */
  static _encodeArray(value, tag = Registry.ARRAY_TAG) {
    // Convert elements and keep a count of how many elements we encounter.
    let count = 0;
    const result = value.map((elem) => {
      count++;
      return Encoder.encode(elem);
    });

    if (value.length !== count) {
      // `Array.map()` skips holes, so a `length` / `count` mismatch
      // occurs iff there is a hole.
      throw new Error('API cannot encode arrays with holes.');
    } else if (value.length !== Object.keys(value).length) {
      // Since we know there are no holes (per above), the only way we
      // could have a different number of keys than the array `length` is
      // if there are additional named properties.
      throw new Error('API cannot encode arrays with named properties.');
    }

    result.unshift(tag); // The specified "header" tag value.
    return Object.freeze(result);
  }

  /**
   * Helper for `encode()` which validates and converts an object which is
   * expected (and verified) to have API metainfo properties.
   *
   * @param {object} value Value to convert.
   * @returns {object} The converted value.
   */
  static _encodeInstance(value) {
    const apiName = value.constructor && value.constructor.API_NAME;
    const toApi = value.toApi;

    if ((typeof apiName !== 'string') || (typeof toApi !== 'function')) {
      throw new Error(`API cannot encode object of class \`${value.constructor.name}\`.`);
    }

    const payload = value.toApi();
    if (!Array.isArray(payload)) {
      throw new Error(`Non-array result from \`toApi()\` on class \`${value.constructor.name}\`.`);
    }

    return Encoder._encodeArray(payload, apiName);
  }
}
