// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Errors } from './Errors';
import { FrozenBuffer } from './FrozenBuffer';
import { Functor } from './Functor';
import { ObjectUtil } from './ObjectUtil';
import { UtilityClass } from './UtilityClass';

/**
 * "Data value" helper utilities. A "data value" is defined as any JavaScript
 * value or object which has no behavior. This includes:
 *
 * * Anything that can be encoded as JSON without loss of fidelity.
 * * Symbols.
 * * `undefined` and `null`.
 * * "Odd-shaped" arrays (ones with holes or extra properties).
 * * By special dispensation, instances of the class `FrozenBuffer` and
 *  `Functor` (both defined in this module).
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
export class DataUtil extends UtilityClass {
  /**
   * Makes a deep-frozen clone of the given data value, or return the value
   * itself if it is already deep-frozen. Depending on the second argument,
   * non-data values either get converted to data (with loss of fidelity) or
   * cause an error to be thrown.
   *
   * @param {*} value Thing to deep freeze.
   * @param {function|null} [nonDataConverter = null] If `null` (the default),
   *   throws an error when non-data is encountered. If non-`null`, must be a
   *   function of one argument. It gets passed a non-data value and is expected
   *   to return a replacement which is a deep-freezable (if not already
   *   deep-frozen) data value, using the same `nonDataConverter` for any
   *   recursively-encountered non-data values.
   * @returns {*} The deep-frozen version of `value`.
   */
  static deepFreeze(value, nonDataConverter = null) {
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
          case FrozenBuffer.prototype: {
            // These are deep-frozen by definition. Easy peasy lemon squeezy!
            return value;
          }
          case Functor.prototype: {
            // Handle functors directly here.
            const args = value.args;
            return DataUtil.isDeepFrozen(args)
              ? value
              : new Functor(value.name, ...(DataUtil.deepFreeze(args, nonDataConverter)));
          }
          default: {
            if (nonDataConverter !== null) {
              return DataUtil.deepFreeze(nonDataConverter(value), nonDataConverter);
            } else {
              throw Errors.badValue(value, 'data value');
            }
          }
        }

        let   anyChange = false;
        const newObj    = cloneBase;

        if (!Object.isFrozen(value)) {
          // The original isn't frozen, which means that the top-level result
          // needs to be a new object (even if all the properties / elements are
          // already frozen).
          anyChange = true;
        }

        for (const k of Object.getOwnPropertyNames(value)) {
          const prop     = Object.getOwnPropertyDescriptor(value, k);
          const oldValue = prop.value;
          if (   (oldValue === undefined)
              && !ObjectUtil.hasOwnProperty(prop, 'value')) {
            // We have just determined that this value isn't actually data.
            // **Note:** The `undefined` check just prevents us from having to
            // call `hasOwnProperty()` in the usual case.
            if (nonDataConverter !== null) {
              // Use the converter on the original object (instead of, say,
              // trying to "edit" its contents).
              return DataUtil.deepFreeze(nonDataConverter(value), nonDataConverter);
            } else {
              throw Errors.badValue(value, 'data value', 'without synthetic properties');
            }
          } else {
            const newValue = DataUtil.deepFreeze(oldValue, nonDataConverter);
            if (oldValue !== newValue) {
              anyChange = true;
            }
            newObj[k] = newValue;
          }
        }

        return anyChange ? Object.freeze(newObj) : value;
      }

      default: {
        if (nonDataConverter !== null) {
          return DataUtil.deepFreeze(nonDataConverter(value), nonDataConverter);
        } else {
          throw Errors.badValue(value, 'data value');
        }
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

      case FrozenBuffer.prototype: {
        return value1.equals(value2);
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
   * Indicates whether or not the given value is a data value.
   *
   * @param {*} value The value to check.
   * @returns {boolean} `true` if `value` is a data value, or `false` if not.
   */
  static isData(value) {
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

    switch (Object.getPrototypeOf(value)) {
      case Object.prototype:
      case Array.prototype: {
        // We have a composite of one of the acceptable standard types (either
        // array or plain object). We still need to check the properties /
        // elements.

        for (const k of Object.getOwnPropertyNames(value)) {
          const prop = Object.getOwnPropertyDescriptor(value, k);
          const v = prop.value;
          if ((v === undefined) && !ObjectUtil.hasOwnProperty(prop, 'value')) {
            // This is a synthetic property.
            return false;
          } else if (!DataUtil.isData(v)) {
            return false;
          }
        }

        return true;
      }

      case FrozenBuffer.prototype: {
        return true;
      }

      case Functor.prototype: {
        return DataUtil.isData(value.args);
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
   * @returns {boolean} `true` if `value` is a deep-frozen data value, or
   *   `false` if not.
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

    switch (Object.getPrototypeOf(value)) {
      case Object.prototype:
      case Array.prototype: {
        if (!Object.isFrozen(value)) {
          return false;
        }

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

      case FrozenBuffer.prototype: {
        // Even though `Object.isFrozen()` returns `false` for `FrozenBuffer`
        // instances, by their behavior they are _effectively_ frozen for the
        // purposes of this class.
        return true;
      }

      case Functor.prototype: {
        return Object.isFrozen(value) && DataUtil.isDeepFrozen(value.args);
      }

      default: {
        return false;
      }
    }
  }
}
