// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Hooks } from 'hooks-common';
import { Errors, UtilityClass } from 'util-common';

/**
 * Type representation of author IDs. The values themselves are always just
 * strings, or in some contexts `null`. This is just where the type checker code
 * lives.
 *
 * At a minimum a non-null author ID has to be a non-empty string. Beyond that,
 * the required syntax is determined via `hooks-common`.
 */
export default class AuthorId extends UtilityClass {
  /**
   * Checks a value of type `AuthorId`.
   *
   * @param {*} value Value to check.
   * @param {boolean} [nullOk = false] If `true` indicates that `null` is an
   *   acceptable value to pass.
   * @returns {string|null} `value`.
   */
  static check(value, nullOk = false) {
    if ((value === null) && nullOk) {
      return null;
    }

    if (   (typeof value !== 'string')
        || (value.length === 0)
        || !Hooks.theOne.isAuthorId(value)) {
      throw Errors.badValue(value, AuthorId);
    }

    return value;
  }

  /**
   * Checks a value which must be of type `AuthorId` or be `null`.
   *
   * @param {*} value Value to check.
   * @returns {string|null} `value`.
   */
  static orNull(value) {
    if (value === null) {
      return null;
    }

    try {
      return AuthorId.check(value);
    } catch (e) {
      // Higher-fidelity error.
      throw Errors.badValue(value, 'AuthorId|null');
    }
  }
}
