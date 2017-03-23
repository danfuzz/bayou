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
   *
   * This method works for any subclass of this class, e.g., if `Foo` is a
   * subclass of `CommonBase`, then `Foo.check(value)` is a check that `value`
   * is an instance of `Foo` (and not just and instance of `CommonBase`).
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
   * Coerces the given value into an instance of this class, if possible. If
   * given an instance of this class, returns that instance. If given any other
   * argument, calls `_impl_coerce()` on that value, which is responsible for
   * the main act of coercion. If coercion isn't possible, this throws an error.
   *
   * This method works for any subclass of this class, e.g., if `Foo` is a
   * subclass of `CommonBase`, then `Foo.coerce(value)` is a coercion of `value`
   * to class `Foo`.
   *
   * By default, `_impl_coerce()` always throws an error. Subclasses can
   * override this to provide more useful behavior.
   *
   * @param {*} value Value to coerce.
   * @returns {object|null} `value` or its coercion to the class that this was
   *   called on, or `null` if `value` can't be coerced.
   */
  static coerce(value) {
    // **Note:** In the context of static methods, `this` refers to the class
    // that was called upon.

    if (value instanceof this) {
      return this;
    } else {
      const result = this._impl_coerce(value);
      if (!(value instanceof this)) {
        // There is a bug in the subclass, as it should never return any other
        // kind of value.
        throw new Error('Invalid `_impl_coerce()` implementation.');
      }
      return result;
    }
  }

  /**
   * Subclass-specifc implementation of `coerce()`. Subclasses can override this
   * as needed.
   *
   * @param {*} value Value to coerce. This is guaranteed _not_ to be an
   *   instance of this class.
   * @returns {object|null} `value` or its coercion to the class that this was
   *   called on, or `null` if `value` can't be coerced.
   */
  static _impl_coerce(value) {
    return this._mustOverride(value);
  }

  /**
   * Coerces the given value into an instance of this class, if possible. If
   * given an instance of this class, returns that instance. If given any other
   * argument, calls `_impl_coerceOrNull()` on that value, which is responsible
   * for the main act of coercion.
   *
   * This method works for any subclass of this class, e.g., if `Foo` is a
   * subclass of `CommonBase`, then `Foo.coerceOrNull(value)` is a coercion of
   * `value` to class `Foo`.
   *
   * By default, `_impl_coerceOrNull()` calls through to `_impl_coerce()` and
   * converts any thrown exceptions to a `null` return. Subclasses can override
   * this to provide more nuanced behavior.
   *
   * @param {*} value Value to coerce.
   * @returns {object|null} `value` or its coercion to the class that this was
   *   called on, or `null` if `value` can't be coerced.
   */
  static coerceOrNull(value) {
    // **Note:** In the context of static methods, `this` refers to the class
    // that was called upon.

    if (value instanceof this) {
      return this;
    } else {
      const result = this._impl_coerceOrNull(value);
      if (!(result instanceof this)) {
        // There is a bug in the subclass, as it should never return any other
        // kind of value.
        throw new Error('Invalid `_impl_coerceOrNull()` implementation.');
      }
      return result;
    }
  }

  /**
   * Subclass-specific implementation of `coerceOrNull()`. Subclasses can
   * override this as needed.
   *
   * @param {*} value Value to coerce. This is guaranteed _not_ to be an
   *   instance of this class.
   * @returns {object|null} `value` or its coercion to the class that this was
   *   called on, or `null` if `value` can't be coerced.
   */
  static _impl_coerceOrNull(value) {
    try {
      return this._impl_coerce(value);
    } catch (error_unused) {
      // Swallow the error and return `null`, per the docs.
      return null;
    }
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
    CommonBase._mustOverride();
  }

  /**
   * Helper function which always throws an error with the message `Must
   * override.`. Using this both documents the intent in code and keeps the
   * linter from complaining about the documentation (`@param`, `@returns`,
   * etc.).
   *
   * @param {...*} args_unused Anything you want, to keep the linter happy.
   */
  static _mustOverride(...args_unused) {
    throw new Error('Must override.');
  }
}
