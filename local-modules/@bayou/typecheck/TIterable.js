// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Errors, UtilityClass } from '@bayou/util-core';

/**
 * Type checker for type `Iterable`.
 *
 * **Note:** Even though there is no built-in JavaScript `Iterable` class per
 * se, this class follows the module's convention of using a `T` name prefix, so
 * as to keep things more straightforward.
 */
export class TIterable extends UtilityClass {
  /**
   * Checks a value of type `Iterable`. Optionally checks the types of entries.
   *
   * **Note:** Checking of entries requires `value` to be iterated over; beware
   * of iterables whose iterators cause side effects! Note particularly that the
   * built-in iterators that are _also_ iterables return themselves as their
   * iterator, which means that you can't iterate over them more than once.
   *
   * @param {*} value Value to check.
   * @param {Function} [entryCheck = null] Entry type checker. If passed as
   *   non-`null`, must be a function that behaves like a standard
   *   `<type>.check()` method.
   * @returns {Iterable} `value`.
   */
  static check(value, entryCheck = null) {
    if (   ((typeof value) !== 'object')
        || ((typeof value[Symbol.iterator]) !== 'function')) {
      throw Errors.badValue(value, 'Iterable');
    }

    if (entryCheck !== null) {
      for (const entry of value) {
        entryCheck(entry);
      }
    }

    return value;
  }
}
