// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CoreTypecheck, Errors, URL, UtilityClass } from 'util-core';

/**
 * Type checker for type `String`.
 */
export default class TString extends UtilityClass {
  /**
   * Checks a value of type `String`. Optionally validates contents against
   * a regex.
   *
   * @param {*} value Value to check.
   * @param {RegExp|null} [regex = null] Regular expression to match against or
   *   `null` if no matching is required. **Note:** If you want to match the
   *   entire `value`, this must be anchored at both ends (`/^...$/`).
   * @returns {string} `value`.
   */
  static check(value, regex = null) {
    // This is defined in `CoreTypecheck` so that it can be used by `util-core`
    // without introducing a circular dependency on this module.
    return CoreTypecheck.checkString(value, regex);
  }

  /**
   * Checks a value of type `String`, which must furthermore be a valid string
   * of hexadecimal bytes (lower case). Optionally checks for a minimum and/or
   * maximum length.
   *
   * @param {*} value Value to check.
   * @param {number} [minBytes = 0] Minimum number of bytes (inclusive).
   * @param {number} [maxBytes = null] Maximum number of bytes (inclusive) or
   * `null` if there is no maximum.
   * @returns {string} `value`.
   */
  static hexBytes(value, minBytes = 0, maxBytes = null) {
    try {
      TString.check(value, /^([0-9a-f]{2})*$/);
    } catch (e) {
      // More on-point error.
      throw Errors.bad_value(value, String, 'even number of hex digits');
    }

    if (value.length < (minBytes * 2)) {
      throw Errors.bad_value(value, String, `byteCount >= ${minBytes}`);
    } else if ((maxBytes !== null) && (value.length > (maxBytes * 2))) {
      throw Errors.bad_value(value, String, `byteCount <= ${maxBytes}`);
    }

    return value;
  }

  /**
   * Checks a value of type `String`, which must furthermore be a valid
   * programming language identifier per the usual rules for same. That is, it
   * must be a non-empty string consisting of characters from the set
   * `[a-zA-Z_0-9]` and with a non-numeric first character.
   *
   * @param {*} value Value to check.
   * @returns {string} `value`.
   */
  static identifier(value) {
    // This is defined in `CoreTypecheck` so that it can be used by `util-core`
    // without introducing a circular dependency on this module.
    return CoreTypecheck.checkIdentifier(value);
  }

  /**
   * Checks a value of type `String`, which must furthermore have at least a
   * given number of characters.
   *
   * @param {*} value Value to check.
   * @param {number} minLen Minimum allowed length.
   * @returns {string} `value`.
   */
  static minLen(value, minLen) {
    if ((typeof value !== 'string') || (value.length < minLen)) {
      throw Errors.bad_value(value, String, `value.length >= ${minLen}`);
    }

    return value;
  }

  /**
   * Checks a value of type `String`, which must furthermore not be empty.
   *
   * @param {*} value Value to check.
   * @returns {string} `value`.
   */
  static nonempty(value) {
    if ((typeof value !== 'string') || (value === '')) {
      throw Errors.bad_value(value, String, 'value !== \'\'');
    }

    return value;
  }

  /**
   * Checks a value which must either be of type `String` or the exact value
   * `null`.
   *
   * @param {*} value Value to check.
   * @returns {string|null} `value`.
   */
  static orNull(value) {
    // This is defined in `CoreTypecheck` so that it can be used by `util-core`
    // without introducing a circular dependency on this module.
    return CoreTypecheck.checkStringOrNull(value);
  }

  /**
   * Checks a value which must be a syntactically valid absolute URL with a path
   * (which can just be `/`) and without auth info. (Auth info consists of a
   * username and optional password before the host name.)
   *
   * @param {*} value Value to check.
   * @returns {string} `value`.
   */
  static urlAbsolute(value) {
    let url;
    try {
      url = new URL(TString.nonempty(value));
    } catch (e) {
      // Throw a higher-fidelity error.
      throw Errors.bad_value(value, String, 'absolute URL syntax');
    }

    // Some versions of `URL` will parse a missing origin into the literal
    // string `null`, hence the third check here. The last check ensures that
    // the original `value` is well-formed; while `new URL()` is somewhat
    // lenient, the `href` it produces is guaranteed to be well-formed, and so
    // the `===` comparison transitively ensures that the original `value` is
    // also well-formed.
    if (!(   url.host
          && url.origin
          && (url.origin !== 'null')
          && (url.href === value))) {
      throw Errors.bad_value(value, String, 'absolute URL syntax');
    }

    if (url.username || url.password) {
      throw Errors.bad_value(value, String, 'absolute URL syntax, without auth');
    }

    return value;
  }

  /**
   * Checks a value which must be a syntactically valid origin-only URL (that
   * is, neither auth nor path fields, and without a final slash).
   *
   * @param {*} value Value to check.
   * @returns {string} `value`.
   */
  static urlOrigin(value) {
    let url;
    try {
      url = new URL(TString.nonempty(value));
    } catch (e) {
      // Throw a higher-fidelity error.
      throw Errors.bad_value(value, String, 'origin-only URL syntax');
    }

    // **Note:** Though `new URL()` is lenient with respect to parsing, if it
    // _does_ parse successfully, `origin` will always be a well-formed URL
    // prefix, and the `!==` comparison here therefore transitively confirms
    // that the original `value` is also well-formed.
    if (value !== url.origin) {
      throw Errors.bad_value(value, String, 'origin-only URL syntax');
    }

    return value;
  }
}
