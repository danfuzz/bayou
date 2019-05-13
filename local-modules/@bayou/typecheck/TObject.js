// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CoreTypecheck, Errors, ObjectUtil, UtilityClass } from '@bayou/util-core';

/**
 * Type checker for type `Object`.
 */
export class TObject extends UtilityClass {
  /**
   * Checks that a value is of type `Object`, and is optionally an instance of
   * a particular class. `null` is _not_ considered an object by this check.
   * Functions _are_ considered objects by this check.
   *
   * @param {*} value Value to check.
   * @param {object|null} [clazz = null] Class (constructor) that `value` must
   *   be an instance of, or `null` if there is no class requirement.
   * @returns {object} `value`.
   */
  static check(value, clazz = null) {
    // This is defined in `CoreTypecheck` so that it can be used by
    // `@bayou/util-core` without introducing a circular dependency on this
    // module.
    return CoreTypecheck.checkObject(value, clazz);
  }

  /**
   * Checks a value which must either be of type `Object` or the exact value
   * `null`.
   *
   * @param {*} value Value to check.
   * @param {object|null} [clazz = null] Class (constructor) that `value` must
   *   be an instance of, or `null` if there is no class requirement.
   * @returns {object|null} `value`.
   */
  static orNull(value, clazz = null) {
    if (value === null) {
      return null;
    }

    try {
      return TObject.check(value, clazz);
    } catch (e) {
      // Throw a higher-fidelity error.
      const name = (clazz === null) ? 'Object' : `class ${clazz.name}`;
      throw Errors.badValue(value, `${name}|null`);
    }
  }

  /**
   * Checks that a value is of type `Object` and is furthermore a plain object,
   * which is to say, not any of an array, a function, or an instance of a class
   * other than `Object` itself. Optionally, also check the object's values for
   * conformance to a given checker.
   *
   * @param {*} value Value to check.
   * @param {function|null} [valueCheck = null] Value type checker. If passed as
   *   non-`null`, must be a function that behaves like a standard
   *   `<type>.check()` method.
   * @returns {object} `value`.
   */
  static plain(value, valueCheck = null) {
    if (!ObjectUtil.isPlain(value)) {
      throw Errors.badValue(value, 'plain object');
    }

    if (valueCheck !== null) {
      TObject._checkValues(value, valueCheck);
    }

    return value;
  }

  /**
   * Checks that a value is a plain object (in the sense of {@link #plain}) or
   * is `null`. Optionally, also check a non-`null` object's values for
   * conformance to a given checker.
   *
   * @param {*} value Value to check.
   * @param {function|null} [valueCheck = null] Value type checker. If passed as
   *   non-`null`, must be a function that behaves like a standard
   *   `<type>.check()` method.
   * @returns {object} `value`.
   */
  static plainOrNull(value, valueCheck = null) {
    if (value === null) {
      return value;
    }

    if (!ObjectUtil.isPlain(value)) {
      throw Errors.badValue(value, 'plain object|null');
    }

    if (valueCheck !== null) {
      TObject._checkValues(value, valueCheck);
    }

    return value;
  }

  /**
   * Checks a value of type `Object`, which must be a plain object with exactly
   * the indicated set of keys as "own" properties.
   *
   * @param {*} value Value to check.
   * @param {array<string>} keys Keys that must be present in `value`.
   * @returns {object} `value`.
   */
  static withExactKeys(value, keys) {
    TObject.plain(value);

    // Make a copy, check for and delete allowed keys, and see if anything's
    // left.

    const copy = Object.assign({}, value);
    for (const k of keys) {
      if (!ObjectUtil.hasOwnProperty(copy, k)) {
        throw Errors.badValue(value, Object, `with key \`${k}\``);
      }
      delete copy[k];
    }

    const remainingKeys = Object.keys(copy);
    if (remainingKeys.length !== 0) {
      let msg = 'Without keys:';
      for (const k of remainingKeys) {
        msg += ` \`${k}\``;
      }
      throw Errors.badValue(value, Object, msg);
    }

    return value;
  }

  /**
   * Helper for {@link #plain} and {@link #plainOrNull}, which does value
   * checking.
   *
   * @param {*} obj Object to check.
   * @param {function} valueCheck Value type checker.
   */
  static _checkValues(obj, valueCheck) {
    for (const v of Object.values(obj)) {
      valueCheck(v);
    }
  }
}
