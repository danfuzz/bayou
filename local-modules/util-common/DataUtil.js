// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';
import { ObjectUtil, UtilityClass } from 'util-common-base';

/**
 * "Data value" helper utilities. A "data value" is defined as any JavaScript
 * value or object which has no behavior. This includes anything that can be
 * encoded as JSON without loss of fidelity and also includes things such as
 * `undefined`, symbols, and "odd-shaped" arrays (ones with holes or extra
 * properties). It notably does _not_ include functions, objects with synthetic
 * properties, or objects with a prototype other than `Object.prototype` or
 * `Array.prototype`.
 */
export default class DataUtil extends UtilityClass {
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
        let cloneBase; // Empty object to start from when cloning.

        if (proto === Object.prototype) {
          cloneBase = {};
        } else if (proto === Array.prototype) {
          cloneBase = [];
        } else {
          throw new Error(`Cannot deep-freeze non-data object: ${value}`);
        }

        let newObj = null;  // Becomes non-`null` with the first change.
        const needToChange = () => {
          if (newObj === null) {
            // Clone the object the first time it needs to be changed.
            newObj = Object.assign(cloneBase, value);
          }
        };

        if (!Object.isFrozen(value)) {
          // The original isn't frozen, which means that the top-level result
          // needs to be a new object (even if all the properties / elements are
          // already frozen).
          needToChange();
        }

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
            needToChange();
            newObj[k] = newValue;
          }
        }

        return (newObj === null) ? value : Object.freeze(newObj);
      }

      default: {
        throw new Error(`Cannot deep-freeze non-data value: ${value}`);
      }
    }
  }

  /**
   * Parses an even-length string of hex digits (lower case), producing a
   * `Buffer`.
   *
   * @param {string} hex String of hex digits.
   * @returns {Buffer} Buffer of parsed bytes.
   */
  static bufferFromHex(hex) {
    TString.hexBytes(hex);

    return Buffer.from(hex, 'hex');
  }
}
