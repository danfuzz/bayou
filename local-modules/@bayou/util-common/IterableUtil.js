// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TIterable } from '@bayou/typecheck';
import { UtilityClass } from '@bayou/util-core';

/**
 * Utility methods for dealing with iterables.
 */
export class IterableUtil extends UtilityClass {
  /**
   * Coerces an iterable-which-might-be-an-iterator into an iterable that is
   * presumed safe to use more than once. Specifically:
   *
   * * Normal iterables are returned as-is.
   * * If given an iterable which also appears to support the `Iterator`
   *   protocol, returns a new iterable which is guaranteed to only iterate
   *   using the originally-passed value once. The new iterable will only call
   *   through to the original on an as-needed basis; that is, it doesn't just
   *   collect the full iteration results up-front.
   *
   * **Context:** The values returned from built-in iteration methods such as
   * `Map.values()` and `Object.entries()` are both `Iterator`s and `Iterable`s,
   * but when used as an iterable, they are _not_ safe to use more than once.
   * So, code that generically accepts an iterable-in-general and expects to
   * iterate using it more than once needs to do _something_ to ensure that it
   * doesn't get undermined by this oddball behavior. This method is one way to
   * get the necessary protection.
   *
   * @param {Iterable} iterable The iterable to ensure safe multiple-use of.
   * @returns {Iterable} `iterable` itself, if safe, or a new instance if not.
   */
  static multiUseSafe(iterable) {
    TIterable.check(iterable);

    if ((typeof iterable.next) !== 'function') {
      // It does not appear to be an `Iterator`.
      return iterable;
    }

    // It looks like an `Iterator`. Provide a safe replacement.

    const iterator = iterable; // Rename to indicate what it really is.
    const elements = [];
    let   done     = false;

    function* makeIterator() {
      // Yield any elements already collected from the original iterator.
      yield* elements;

      // Continue to iterate over the original iterator, until it's exhausted.

      let at = elements.length;
      for (;;) {
        // Yield elements that got appended by other simultaneously-active
        // iterators or by our own handling of `next()` below.

        while (at < elements.length) {
          yield elements[at];
          at++;
        }

        if (done) {
          break;
        }

        // Append one more element to `elements`, or note that the iterator is
        // done if that turns out to be the case.

        const next = iterator.next();
        if (next.done) {
          done = true;
          break;
        } else {
          elements.push(next.value);
        }
      }
    }

    return { [Symbol.iterator]: makeIterator };
  }
}
