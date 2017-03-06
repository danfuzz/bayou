// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TArray, TInt, TString } from 'typecheck';
import { ObjectUtil } from 'util-base';

/**
 * "Data value" helper utilities. A "data value" is defined as any JavaScript
 * value or object which has no behavior. This includes anything that can be
 * encoded as JSON without loss of fidelity and also includes things such as
 * `undefined`, symbols, and "odd-shaped" arrays (ones with holes or extra
 * properties). It notably does _not_ include functions, objects with synthetic
 * properties, or objects with a prototype other than `Object.prototype` or
 * `Array.prototype`.
 */
export default class DataUtil {
  /**
   * Makes a deep-frozen clone of the given data value, or return the value
   * itself if it is already deep-frozen.
   *
   * @param {*} value Thing to deep freeze.
   * @returns {*} The deep-frozen version of `value`.
   */
  static deepFreeze(value) {
    switch (typeof value) {
      case 'boolean':
      case 'number':
      case 'string':
      case 'symbol':
      case 'undefined': {
        // Pass through as-is.
        return value;
      }

      case 'object': {
        if (value === null) {
          // Pass through as-is.
          return value;
        }

        const proto = Object.getPrototypeOf(value);
        let cloneBase = null; // Empty object to start from when cloning.

        if (proto === Object.prototype) {
          cloneBase = {};
        } else if (proto === Array.prototype) {
          cloneBase = [];
        } else {
          throw new Error(`Cannot deep-freeze non-data object: ${value}`);
        }

        let newObj = value;
        let any = false; // Becomes `true` the first time a change is made.

        for (const k of Object.getOwnPropertyNames(value)) {
          const prop = Object.getOwnPropertyDescriptor(value, k);
          const oldValue = prop.value;
          if (   (oldValue === undefined)
              && !ObjectUtil.hasOwnProperty(prop, 'value')) {
            // **Note:** The `undefined` check just prevents us from having to
            // call `hasOwnProperty()` in the usual case.
            throw new Error(`Cannot deep-freeze object with synthetic property: ${value}`);
          }
          const newValue = DataUtil.deepFreeze(oldValue);
          if (oldValue !== newValue) {
            if (!any) {
              newObj = Object.assign(cloneBase, value); // Clone the object.
              any = true;
            }
            newObj[k] = newValue;
          }
        }

        Object.freeze(newObj);
        return newObj;
      }

      default: {
        throw new Error(`Cannot deep-freeze non-data value: ${value}`);
      }
    }
  }

  /**
   * Parses an even-length string of hex digits (lower case), producing an array
   * of unsigned integers in the range `0..255`.
   *
   * @param {string} hex String of hex digits.
   * @returns {Array<int>} Array of parsed bytes, always frozen.
   */
  static bytesFromHex(hex) {
    TString.hexBytes(hex);

    const result = [];
    for (let i = 0; i < hex.length; i += 2) {
      result.push(parseInt(hex.slice(i, i + 2), 16));
    }

    return Object.freeze(result);
  }

  /**
   * Converts an array of byte values to a hex string.
   *
   * @param {Array<int>} bytes Byte values.
   * @returns {string} Equivalent hex string.
   */
  static hexFromBytes(bytes) {
    TArray.check(bytes, TInt.check); // TODO: Should validate range too.

    function byteString(byte) {
      const result = byte.toString(16);
      return (byte < 16) ? `0${result}` : result;
    }

    return bytes.map(byteString).join('');
  }
}
