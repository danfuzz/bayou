// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TypeError } from 'typecheck';

/**
 * Type representation of version numbers. The values themselves are always
 * just non-negative integers. This is just where the type checker code lives.
 */
export default class VersionNumber {
  /**
   * Checks a value of type `VersionNumber`.
   *
   * @param {*} value Value to check.
   * @param {number} [max] Maximum acceptable value (inclusive). If
   *   `undefined`, there is no upper limit.
   * @param {*} [ifAbsent] Default value. If passed and `value` is `undefined`,
   *   this method will return this value instead of throwing an error.
   * @returns {number} `value` or `ifAbsent`.
   */
  static check(value, max = undefined, ifAbsent = undefined) {
    if ((value === undefined) && (ifAbsent !== undefined)) {
      return ifAbsent;
    }

    if (   (typeof value !== 'number')
        || !Number.isSafeInteger(value)
        || (value < 0)) {
      return TypeError.badValue(value, 'versionNumber');
    }

    if ((max !== undefined) && (value > max)) {
      return TypeError.badValue(value, 'versionNumber', `value <= ${max}`);
    }

    return value;
  }
}
