// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Functor, UtilityClass } from '@bayou/util-common';
import { TInt, TString } from '@bayou/typecheck';

/**
 * Performer of various kinds of redaction on {@link LogRecord} instances and
 * their constituent parts.
 */
export default class LogRedactor extends UtilityClass {
  /**
   * Truncates a string to be no more than the given number of characters,
   * including the truncation-indicating ellipsis, if truncated.
   *
   * @param {string} value Original string value.
   * @param {Int} maxLength Maximum length to represent. Must be at least `3`.
   * @returns {string} `orig` if its length is `maxLength` or smaller, or an
   *   appropriately-truncated representation.
   */
  static truncateString(value, maxLength) {
    TString.check(value);
    TInt.min(maxLength, 3);

    if (value.length <= maxLength) {
      return value;
    } else {
      return `${value.slice(0, maxLength - 3)}...`;
    }
  }

  /**
   * Fully redact the indicated value, indicating only its type (perhaps
   * implicitly). As special cases, `null` and `undefined` are passed through
   * as-is.
   *
   * @param {*} value Original value.
   * @returns {*} Fully-redacted form.
   */
  static fullyRedact(value) {
    const type = typeof value;

    switch (type) {
      case 'object': {
        if (value === null) {
          return null;
        } else if (Array.isArray(value)) {
          return ['...'];
        }

        const name = value.constructor ? value.constructor.name : null;
        if ((typeof name === 'string') && (Object.getPrototypeOf(value) !== Object.prototype)) {
          return new Functor(`new_${name}`, '...');
        } else {
          return { '...': '...' };
        }
      }

      case 'string': {
        return '...';
      }

      case 'undefined': {
        return undefined;
      }

      default: {
        return new Functor(type, '...');
      }
    }
  }
}
