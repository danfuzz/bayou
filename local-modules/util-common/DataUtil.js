// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * "Data value" helper utilities. A "data value" is defined as a JavaScript
 * value or object which can be encoded as JSON without loss of fidelity. For
 * example, this means that arrays don't have "holes" or extra properties,
 * that object values are all just other data values (e.g. _not_ methods or
 * synthetic properties), objects only have `Object.prototype` as their
 * prototype, etc.
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
    if (typeof value !== 'object') {
      return value;
    }

    let newObj = value;
    let any = false; // Becomes `true` the first time a change is made.

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const oldValue = value[i];
        const newValue = DataUtil.deepFreeze(oldValue);
        if (oldValue !== newValue) {
          if (!any) {
            newObj = value.slice(); // Clone the array.
            any = true;
          }
          newObj[i] = newValue;
        }
      }
    } else {
      for (const k in value) {
        const oldValue = value[k];
        const newValue = DataUtil.deepFreeze(oldValue);
        if (oldValue !== newValue) {
          if (!any) {
            newObj = Object.assign({}, value); // Clone the object.
            any = true;
          }
          newObj[k] = newValue;
        }
      }
    }

    Object.freeze(newObj);
    return newObj;
  }
}
