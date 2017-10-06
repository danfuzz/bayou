// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Errors from './Errors';
import Functor from './Functor';
import ObjectUtil from './ObjectUtil';
import UtilityClass from './UtilityClass';

/**
 * "Data value" helper utilities. A "data value" is defined as any JavaScript
 * value or object which has no behavior. This includes:
 *
 * * Anything that can be encoded as JSON without loss of fidelity.
 * * Symbols.
 * * `undefined` and `null`.
 * * "Odd-shaped" arrays (ones with holes or extra properties).
 * * By special dispensation, instances of the class `Functor` (defined in this
 *   module).
 *
 * This does _not_ include:
 *
 * * Functions.
 * * Objects with synthetic properties.
 * * Objects with a prototype other than `Object.prototype`, `Array.prototype`,
 *   or `Functor.prototype`.
 * * Any composite value with an element that is not a data value, per these
 *   rules.
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

        let cloneBase; // Empty object to start from when cloning.

        switch (Object.getPrototypeOf(value)) {
          case Object.prototype: {
            cloneBase = {};
            break;
          }
          case Array.prototype: {
            cloneBase = [];
            break;
          }
          case Functor.prototype: {
            // Handle functors directly here.
            const args = value.args;
            return DataUtil.isDeepFrozen(args)
              ? value
              : new Functor(value.name, ...(DataUtil.deepFreeze(args)));
          }
          default: {
            throw Errors.bad_value(value, 'data value');
          }
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
            throw Errors.bad_value(value, 'data value', 'without synthetic properties');
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
        throw Errors.bad_value(value, 'data value');
      }
    }
  }

  /**
   * Indicates whether the two given values (a) are both data values, and (b)
   * contain the same data.
   *
   * @param {*} value1 Value to inspect.
   * @param {*} value2 Other value to inspec.
   * @returns {boolean} `true` iff both values are data values and contain the
   *   same data.
   */
  static equalData(value1, value2) {
    const type1 = typeof value1;

    if (type1 !== typeof value2) {
      return false;
    }

    switch (type1) {
      case 'boolean':
      case 'number':
      case 'string':
      case 'symbol':
      case 'undefined': {
        // `Object.is()` handles numeric edge cases (`NaN`, etc.) sensibly.
        return Object.is(value1, value2);
      }

      case 'object': {
        if ((value1 === null) || (value2 === null)) {
          return value1 === value2;
        }
        break;
      }

      default: {
        // This includes `function`.
        return false;
      }
    }

    // At this point, we know that `value1` is a non-null object(ish) value,
    // which is _not_ a function or generator.

    const proto1 = Object.getPrototypeOf(value1);
    if (proto1 !== Object.getPrototypeOf(value2)) {
      return false;
    }

    switch (proto1) {
      case Object.prototype:
      case Array.prototype: {
        // One of the acceptable standard types (either array or plain object).
        // We still need to compare the properties / elements.

        const names1 = Object.getOwnPropertyNames(value1);
        const names2 = Object.getOwnPropertyNames(value2);

        if (names1.length !== names2.length) {
          return false;
        }

        names1.sort();
        names2.sort();

        for (let i = 0; i < names1.length; i++) {
          if (names1[i] !== names2[i]) {
            return false;
          }
        }

        // We now know both values have identically-named properties.

        for (const name of names1) {
          const prop1 = Object.getOwnPropertyDescriptor(value1, name);
          const prop2 = Object.getOwnPropertyDescriptor(value2, name);
          const v1 = prop1.value;
          const v2 = prop2.value;

          if (   ((v1 === undefined) && !ObjectUtil.hasOwnProperty(prop1, 'value'))
              || ((v2 === undefined) && !ObjectUtil.hasOwnProperty(prop2, 'value'))) {
            // One or the other (or both) is a synthetic property.
            return false;
          } else if (!DataUtil.equalData(v1, v2)) {
            return false;
          }
        }

        return true;
      }

      case Functor.prototype: {
        return (value1.name === value2.name)
          && DataUtil.equalData(value1.args, value2.args);
      }

      default: {
        return false;
      }
    }
  }

  /**
   * Indicates whether or not the given value is a deep-frozen data value.
   *
   * @param {*} value The value to check.
   * @returns {boolean} `true` if `value` is deep-frozen, or `false` if not.
   */
  static isDeepFrozen(value) {
    switch (typeof value) {
      case 'boolean':
      case 'number':
      case 'string':
      case 'symbol':
      case 'undefined': {
        return true;
      }

      case 'object': {
        if (value === null) {
          return true;
        }
        break;
      }

      default: {
        // This includes `function`.
        return false;
      }
    }

    // At this point, we have a non-null object(ish) value, which is _not_ a
    // function or generator.

    if (!Object.isFrozen(value)) {
      return false;
    }

    switch (Object.getPrototypeOf(value)) {
      case Object.prototype:
      case Array.prototype: {
        // We have a frozen composite of one of the acceptable standard types
        // (either array or plain object). We still need to check the
        // properties / elements.

        for (const k of Object.getOwnPropertyNames(value)) {
          const prop = Object.getOwnPropertyDescriptor(value, k);
          const v = prop.value;
          if ((v === undefined) && !ObjectUtil.hasOwnProperty(prop, 'value')) {
            // This is a synthetic property.
            return false;
          } else if (!DataUtil.isDeepFrozen(v)) {
            return false;
          }
        }

        return true;
      }

      case Functor.prototype: {
        return DataUtil.isDeepFrozen(value.args);
      }

      default: {
        return false;
      }
    }
  }
}
