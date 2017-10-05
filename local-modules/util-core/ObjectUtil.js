// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import CoreTypecheck from './CoreTypecheck';
import Errors from './Errors';
import UtilityClass from './UtilityClass';

/**
 * `Object` helper utilities.
 */
export default class ObjectUtil extends UtilityClass {
  /**
   * Extracts the named keys from the given object, returning a new frozen
   * plain object (frozen but not deep-frozen) with those bindings. It is an
   * error if the given value doesn't have all of the named bindings.
   *
   * @param {object} value Object to extract bindings from.
   * @param {array<string>} keys Keys to extract.
   * @returns {object} Frozen object which binds all of `keys` to the same
   *   values as in `value`.
   */
  static extract(value, keys) {
    CoreTypecheck.checkObject(value);

    const result = {};

    for (const k of keys) {
      CoreTypecheck.checkString(k);

      const v = result[k] = value[k];
      if ((v === undefined) && !ObjectUtil.hasOwnProperty(value, k)) {
        throw Errors.bad_use(`Missing property: ${k}`);
      }
    }

    Object.freeze(result);
    return result;
  }

  /**
   * Calls `value.hasOwnProperty()` safely.
   *
   * @param {object} value Value to query.
   * @param {string} name Name of property in question.
   * @returns {boolean} `true` iff `value` has an own-property with the given
   *   name.
   */
  static hasOwnProperty(value, name) {
    return Object.prototype.hasOwnProperty.call(value, name);
  }

  /**
   * Tests whether a value is a "plain object." A plain object is defined as
   * being a value of type `object` which is not `null` and whose direct
   * prototype is `Object.prototype`. Notably, arrays are _not_ plain objects.
   *
   * @param {*} value Value to check.
   * @returns {boolean} `true` if `value` is a plain object, or `false` if not.
   */
  static isSimple(value) {
    return (typeof value === 'object')
        && (value !== null)
        && (Object.getPrototypeOf(value) === Object.prototype);
  }
}
