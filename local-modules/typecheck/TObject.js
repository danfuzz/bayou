// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import TypeError from './TypeError';

/**
 * Calls `value.hasOwnProperty()` safely.
 *
 * **Note:** This is a duplicate of the same code in `ObjectUtil` so as to
 * avoid a circular module dependency.
 *
 * @param {object} value Value to query.
 * @param {string} name Name of property in question.
 * @returns {boolean} `true` iff `value` has an own-property with the given name.
 */
function hasOwnProperty(value, name) {
  return Object.prototype.hasOwnProperty.call(value, name);
}

/**
 * Type checker for type `Object`.
 */
export default class TObject {
  /**
   * Checks a value of type `Object`.
   *
   * @param {*} value Value to check.
   * @param {object} [clazz = null] Class (constructor) that `value` must be an
   *   instance of. If `null` then there is no class requirement.
   * @returns {object} `value`.
   */
  static check(value, clazz = null) {
    if (typeof value !== 'object') {
      return TypeError.badValue(value, 'Object');
    } else if ((clazz !== null) && !(value instanceof clazz)) {
      return TypeError.badValue(value, 'Object', `of class ${clazz.name}`);
    }

    return value;
  }

  /**
   * Checks a value of type `Object`, which must have exactly the indicated set
   * of keys as "own" properties.
   *
   * @param {*} value Value to check.
   * @param {Array<string>} keys Keys that must be present in `value`.
   * @returns {object} `value`.
   */
  static withExactKeys(value, keys) {
    if (typeof value !== 'object') {
      return TypeError.badValue(value, 'Object');
    }

    // Make a copy, check for and delete allowed keys, and see if anything's
    // left.

    const copy = Object.assign({}, value);
    for (const k of keys) {
      if (!hasOwnProperty(copy, k)) {
        return TypeError.badValue(value, 'Object', `Missing key \`${k}\``);
      }
      delete copy[k];
    }

    const remainingKeys = Object.keys(copy);
    if (remainingKeys.length !== 0) {
      let msg = 'Extra keys';
      for (const k of remainingKeys) {
        msg += ` \`${k}\``;
      }
      return TypeError.badValue(value, 'Object', msg);
    }

    return value;
  }
}
