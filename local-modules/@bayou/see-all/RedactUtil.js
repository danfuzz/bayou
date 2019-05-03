// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Functor, UtilityClass } from '@bayou/util-common';
import { TInt, TString } from '@bayou/typecheck';

/**
 * {Int} Maximum number of array elements to show in a structure-preserving
 * redaction.
 */
const MAX_ARRAY_ELEMENTS = 10;

/**
 * {Int} Maximum number of plain-object keys to show in a structure-preserving
 * redaction.
 */
const MAX_OBJECT_KEYS = 20;

/**
 * Performer of various kinds of redaction on {@link LogRecord} instances and
 * their constituent parts.
 */
export class RedactUtil extends UtilityClass {
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
        } else if (value instanceof Functor) {
          // Treat this analogously to a constructed object: Show the name but
          // no arguments.
          return new Functor(value.name, '...');
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

  /**
   * Redacts the values within the given (top) value, leaving the structure
   * apparent, to an indicated depth.
   *
   * @param {*} value Original value.
   * @param {Int} maxDepth Maximum depth to preserve; below that, values are
   *   fully redacted (see {@link #fullyRedact}).
   * @returns {*} Structure-preserving redacted form.
   */
  static redactValues(value, maxDepth) {
    TInt.nonNegative(maxDepth);

    if (maxDepth === 0) {
      return RedactUtil.fullyRedact(value);
    }

    const nextDepth = maxDepth - 1;
    const type      = typeof value;

    switch (type) {
      case 'object': {
        if (value === null) {
          return null;
        } else if (Array.isArray(value)) {
          const result = [];
          let   count  = 0;
          for (const v of value) {
            if (count === MAX_ARRAY_ELEMENTS) {
              result.push(`... ${value.length - MAX_ARRAY_ELEMENTS} more`);
              break;
            }
            result.push(RedactUtil.redactValues(v, nextDepth));
            count++;
          }
          return result;
        } else if (value instanceof Functor) {
          // Show the name and recursively redact arguments.
          const args = value.args.map(a => RedactUtil.redactValues(a, nextDepth));
          return new Functor(value.name, ...args);
        }

        const name = value.constructor ? value.constructor.name : null;
        if ((typeof name === 'string') && (Object.getPrototypeOf(value) !== Object.prototype)) {
          // **TODO:** Consider redacting the result of `deconstruct()` when
          // that method is available on `value`.
          return new Functor(`new_${name}`, '...');
        } else {
          const keys   = Object.keys(value).sort();
          const result = {};
          let   count  = 0;
          for (const k of keys) {
            if (count === MAX_OBJECT_KEYS) {
              result['...'] = `... ${keys.length - MAX_OBJECT_KEYS} more`;
              break;
            }
            result[k] = RedactUtil.redactValues(value[k], nextDepth);
            count++;
          }
          return result;
        }
      }

      case 'string': {
        return `... length ${value.length}`;
      }

      case 'undefined': {
        return undefined;
      }

      default: {
        return new Functor(type, '...');
      }
    }
  }

  /**
   * Wrap the given value in a `redacted(...)` functor, as a way to indicate
   * that the value is indeed redacted in some way.
   *
   * @param {*} value Value to wrap.
   * @returns {Functor} Appropriately-wrapped form.
   */
  static wrapRedacted(value) {
    return new Functor('redacted', value);
  }

  /**
   * Wrap the given value in a `truncated(...)` functor, as a way to indicate
   * that the value is indeed truncated in some way.
   *
   * @param {*} value Value to wrap.
   * @returns {Functor} Appropriately-wrapped form.
   */
  static wrapTruncated(value) {
    return new Functor('truncated', value);
  }
}
