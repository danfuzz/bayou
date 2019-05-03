// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from '@bayou/typecheck';
import { Errors, UtilityClass } from '@bayou/util-common';

import { BearerToken } from './BearerToken';

/** {RegExp} Regular expression which matches valid target IDs. */
const VALID_TARGET_ID_REGEX = /^[-_.a-zA-Z0-9]{1,256}$/;

/**
 * Type representation of target IDs. The values themselves are always just
 * strings. This is just where the type checker code lives.
 *
 * A "target ID" is a string identifier which "names" an object at an API
 * boundary. There are both "well-known" IDs (most notably `meta`) as well as
 * programatically-generated IDs (e.g. for specific files).
 *
 * Syntactically, a target ID must be a string of consisting of ASCII-range
 * alphanumerics, underscore (`_`), dash (`-`), or period (`.`), which is at
 * least one and no longer than 256 characters.
 */
export class TargetId extends UtilityClass {
  /**
   * Checks a value of type `TargetId`.
   *
   * @param {*} value Value to check.
   * @returns {string} `value` if it is in fact a valid target ID.
   */
  static check(value) {
    try {
      return TString.check(value, VALID_TARGET_ID_REGEX);
    } catch (e) {
      // Throw a higher-fidelity error.
      throw Errors.badValue(value, TargetId);
    }
  }

  /**
   * Checks a value which must either be a `TargetId` per se or an instance of
   * {@link BearerToken}.
   *
   * @param {*} value The value in question.
   * @returns {string|BearerToken} `value` if it is either valid target ID
   *   string or is an instance of {@link BearerToken}.
   */
  static orToken(value) {
    if (value instanceof BearerToken) {
      return value;
    }

    try {
      return TargetId.check(value);
    } catch (e) {
      // Throw a higher-fidelity error.
      throw Errors.badValue(value, 'TargetId|BearerToken');
    }
  }

  /**
   * Gets the string to use when logging an ID or token. Plain IDs are returned
   * as-is, and {@link BearerToken} instances are converted into their "safe
   * string" (redacted) forms.
   *
   * @param {string|BearerToken} idOrToken The ID or token which identifies the
   *   target.
   * @returns {string} The string to use to refer to `idOrToken` in logs.
   */
  static safeString(idOrToken) {
    TargetId.orToken(idOrToken);

    return (idOrToken instanceof BearerToken) ? idOrToken.safeString : idOrToken;
  }
}
