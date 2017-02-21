// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ObjectUtil } from 'util-common';

import TypeError from './TypeError';

/**
 * Type checker for type `Object`.
 */
export default class TObject {
  /**
   * Checks a value of type `object`.
   *
   * @param {*} value Value to check.
   * @returns {object} `value`.
   */
  static check(value) {
    if (typeof value !== 'object') {
      return TypeError.badValue(value, 'object');
    }

    return value;
  }

  /**
   * Checks a value of type `object`, which must have exactly the indicated set
   * of keys as "own" properties.
   *
   * @param {*} value Value to check.
   * @param {Array<string>} keys Keys that must be present in `value`.
   * @returns {object} `value`.
   */
  static withExactKeys(value, keys) {
    if (typeof value !== 'object') {
      return TypeError.badValue(value, 'object');
    }

    // Make a copy, check for and delete allowed keys, and see if anything's
    // left.

    const copy = Object.assign({}, value);
    for (const k of keys) {
      if (!ObjectUtil.hasOwnProperty(copy, k)) {
        return TypeError.badValue(value, 'object', `Missing key \`${k}\``);
      }
      delete copy[k];
    }

    const remainingKeys = Object.keys(copy);
    if (remainingKeys.length !== 0) {
      let msg = 'Extra keys';
      for (const k of remainingKeys) {
        msg += ` \`${k}\``;
      }
      return TypeError.badValue(value, 'object', msg);
    }

    return value;
  }
}
