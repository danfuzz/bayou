// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// **Note:** Webpack's browser polyfill includes a Node-compatible `url`
// module, which is why this is possible to import regardless of environment.
import { URL } from 'url';

import { UtilityClass } from 'util-common-base';

import TypeError from './TypeError';

/**
 * Type checker for type `String`.
 */
export default class TString extends UtilityClass {
  /**
   * Checks a value of type `String`. Optionally validates contents against
   * a regex.
   *
   * @param {*} value Value to check.
   * @param {RegExp} [regex = null] Regular expression to match against or
   *   `null` if no matching is required. **Note:** If you want to match the
   *   entire `value`, this must be anchored at both ends (`/^...$/`).
   * @returns {string} `value`.
   */
  static check(value, regex = null) {
    if (typeof value !== 'string') {
      return TypeError.badValue(value, 'String');
    }

    if ((regex !== null) && !regex.test(value)) {
      return TypeError.badValue(value, 'String', `!${regex}.test()`);
    }

    return value;
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
      return TypeError.badValue(value, 'String', 'even number of hex digits');
    }

    if (value.length < (minBytes * 2)) {
      return TypeError.badValue(value, 'String', `byteCount >= ${minBytes}`);
    } else if ((maxBytes !== null) && (value.length > (maxBytes * 2))) {
      return TypeError.badValue(value, 'String', `byteCount <= ${maxBytes}`);
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
    try {
      return TString.check(value, /^[a-zA-Z_][a-zA-Z_0-9]*$/);
    } catch (e) {
      // More on-point error.
      return TypeError.badValue(value, 'String', 'identifier');
    }
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
      return TypeError.badValue(value, 'String', `value.length >= ${minLen}`);
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
      return TypeError.badValue(value, 'String', 'value !== \'\'');
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
    if ((value !== null) && (typeof value !== 'string')) {
      return TypeError.badValue(value, 'String|null');
    }

    return value;
  }

  /**
   * Checks a value which must be a syntactically valid absolute URL without
   * auth info. (Auth info consists of a username and optional password before
   * the host name.)
   *
   * @param {*} value Value to check.
   * @returns {string} `value`.
   */
  static urlAbsolute(value) {
    let url;
    try {
      // `new URL()` is somewhat lenient with syntax checking. **TODO:** Might
      // want to be less lenient.
      url = new URL(TString.nonempty(value));
    } catch (e) {
      // Throw a higher-fidelity error.
      return TypeError.badValue(value, 'String', 'absolute URL syntax');
    }

    if (!url.host) {
      return TypeError.badValue(value, 'String', 'absolute URL syntax');
    }

    if (url.username || url.password) {
      return TypeError.badValue(
        value, 'String', 'absolute URL syntax, without auth');
    }

    return value;
  }

  /**
   * Checks a value which must be a syntactically valid origin-only URL (that
   * is, neither auth nor path fields).
   *
   * @param {*} value Value to check.
   * @returns {string} `value`.
   */
  static urlOrigin(value) {
    let url;
    try {
      // `new URL()` is somewhat lenient with syntax checking. **TODO:** Might
      // want to be less lenient.
      url = new URL(TString.nonempty(value));
    } catch (e) {
      // Throw a higher-fidelity error.
      return TypeError.badValue(value, 'String', 'origin-only URL syntax');
    }

    if (value !== url.origin) {
      return TypeError.badValue(value, 'String', 'origin-only URL syntax');
    }

    return value;
  }
}
