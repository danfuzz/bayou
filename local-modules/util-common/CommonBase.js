// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TObject } from 'typecheck';

/**
 * Base class which provides a couple conveniences beyond what baseline
 * JavaScript has.
 */
export default class CommonBase {
  /**
   * Checks that a value is an instance of this class. Throws an error if not.
   * This works for any subclass of this class, e.g., if `Foo` is a subclass of
   * `CommonBase`, then `Foo.check(value)` is a check that `value` is an
   * instance of `Foo` (and not just and instance of `CommonBase`).
   *
   * @param {*} value Value to check.
   * @returns {BearerToken} `value`.
   */
  static check(value) {
    // **Note:** In the context of static methods, `this` refers to the class
    // that was called upon.
    return TObject.check(value, this);
  }

  /**
   * Helper function which always throws an error with the message `Must
   * override.`. Using this both documents the intent in code and keeps the
   * linter from complaining about the documentation (`@param`, `@returns`,
   * etc.).
   *
   * @param {...*} args_unused Anything you want, to keep the linter happy.
   */
  _mustOverride(...args_unused) {
    throw new Error('Must override.');
  }
}
