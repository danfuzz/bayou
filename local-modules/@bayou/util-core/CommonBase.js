// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { CoreTypecheck } from './CoreTypecheck';
import { Errors } from './Errors';
import { ObjectUtil } from './ObjectUtil';

/**
 * Base class which provides a couple conveniences beyond what baseline
 * JavaScript has.
 *
 * @abstract
 */
export class CommonBase {
  /**
   * Checks that a value is an instance of this class. Throws an error if not.
   *
   * This method works for any subclass of this class, e.g., if `Foo` is a
   * subclass of `CommonBase`, then `Foo.check(value)` is a check that `value`
   * is an instance of `Foo` (and not just and instance of `CommonBase`).
   *
   * @param {*} value Value to check.
   * @returns {this} `value`, an object whose class is the same as the class
   *   that this method was called on.
   */
  static check(value) {
    // **Note:** In the context of static methods, `this` refers to the class
    // that was called upon.
    return CoreTypecheck.checkObject(value, this);
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
   * @returns {this} `value` or its coercion to the class that this was
   *   called on. Will always be an instance of the same class that this method
   *   was called on.
   */
  static coerce(value) {
    // **Note:** In the context of static methods, `this` refers to the class
    // that was called upon.

    if (value instanceof this) {
      return value;
    } else {
      const result = this._impl_coerce(value);
      if (!(result instanceof this)) {
        // There is a bug in the subclass, as it should never return any other
        // kind of value.
        throw Errors.badUse('Invalid `_impl_coerce()` implementation.');
      }
      return result;
    }
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
   * @returns {this|null} `value` or its coercion to the class that this was
   *   called on, or `null` if `value` can't be coerced. If non-null, must
   *   always be an instance of the same class that this method was called on.
   */
  static coerceOrNull(value) {
    // **Note:** In the context of static methods, `this` refers to the class
    // that was called upon.

    if (value instanceof this) {
      return value;
    } else {
      const result = this._impl_coerceOrNull(value);
      if ((result !== null) && !(result instanceof this)) {
        // There is a bug in the subclass, as it should never return any other
        // kind of value.
        throw Errors.badUse('Invalid `_impl_coerceOrNull()` implementation.');
      }
      return result;
    }
  }

  /**
   * Adds the instance and static properties defined on this class to another
   * class, that is, treat this class as a "mixin" and apply it to the given
   * class. If the given class already defines any of the methods, the original
   * definitions take precedence.
   *
   * @param {class} clazz Class to mix into.
   */
  static mixInto(clazz) {
    // **Note:** In the context of static methods, `this` refers to the class
    // that was called upon.

    function mixOne(target, source) {
      const keys = [
        ...Object.getOwnPropertyNames(source),
        ...Object.getOwnPropertySymbols(source)
      ];

      for (const key of keys) {
        if (!ObjectUtil.hasOwnProperty(target, key)) {
          Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        }
      }
    }

    mixOne(clazz, this);                     // Mix in the static properties.
    mixOne(clazz.prototype, this.prototype); // Mix in the instance properties.
  }

  /**
   * Same as calling the custom inspector function via its symbol-bound method,
   * `[util.inpsect.custom]`. Subclasses that wish to provide custom `inspect()`
   * functionality should do so by overriding the symbol-bound method and not
   * this one.
   *
   * _This_ method exists because, as of this writing, the browser polyfill for
   * `util.inspect()` doesn't find `util.inspect.custom` methods. **TODO:**
   * Occasionally check to see if this workaround is still needed, and remove it
   * if it is finally unnecessary.
   *
   * @param {Int} depth Current inspection depth.
   * @param {object} opts Inspection options.
   * @returns {string} The inspection string form of this instance.
   */
  inspect(depth, opts) {
    return this[inspect.custom](depth, opts);
  }

  /**
   * Custom inspector function, as called by `util.inspect()`. This
   * implementation returns a string that uses the instance's class name and
   * either a constructor-like or map-like form for the payload. If the class
   * defines `deconstruct()`, then the result of that is used for a
   * constructor-like form. Otherwise, the public synthetic properties are used
   * to form the map-like form (which is an arrangement by and large suitable
   * for classes as typically defined in this project).
   *
   * Subclasses may choose to override this method if they can produce something
   * more appropriate and/or higher fidelity.
   *
   * @param {Int} depth Current inspection depth.
   * @param {object} opts Inspection options.
   * @returns {string} The inspection string form of this instance.
   */
  [inspect.custom](depth, opts) {
    // Set up the inspection opts so that recursive `inspect()` calls respect
    // the topmost requested depth.
    const subOpts = (opts.depth === null)
      ? opts
      : Object.assign({}, opts, { depth: opts.depth - 1 });

    if (typeof this.deconstruct === 'function') {
      return this._inspectLikeConstructor(depth, subOpts);
    } else {
      return this._inspectLikeMap(depth, subOpts);
    }
  }

  /**
   * Gets the string form of this instance. This implementation calls through
   * to `util.inspect()` requesting a single-line result with the default
   * recursion depth (which is `2` as of this writing).
   *
   * @returns {string} The string form of this instance.
   */
  toString() {
    return inspect(this, { breakLength: Infinity });
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
   * `inspect()` implementation for the case where the class defines a
   * `deconstruct()` method. In this case, the result resembles a `new` call to
   * the class except without the `new` per se.
   *
   * @param {Int} depth Current inspection depth.
   * @param {object} subOpts Inspection options for any recursive `inspect()`
   *   calls.
   * @returns {string} The inspection string form of this instance.
   */
  _inspectLikeConstructor(depth, subOpts) {
    const name = this.constructor.name;
    const args = this.deconstruct();

    if (args.length === 0) {
      return `${name}()`;
    } else if (depth < 0) {
      return `${name}(...)`;
    }

    const result = [name];
    for (const arg of args) {
      result.push((result.length === 1) ? '(' : ', ');
      result.push(inspect(arg, subOpts));
    }
    result.push(')');

    return result.join('');
  }

  /**
   * `inspect()` implementation for the case where the class does not define a
   * `deconstruct()` method. In this case, the result resembles the inspection
   * of a map or a plain object.
   *
   * @param {Int} depth Current inspection depth.
   * @param {object} subOpts Inspection options for any recursive `inspect()`
   *   calls.
   * @returns {string} The inspection string form of this instance.
   */
  _inspectLikeMap(depth, subOpts) {
    const name = this.constructor.name;

    if (depth < 0) {
      return `${name} {...}`;
    }

    // Walk the prototype chain up to this class, collecting the values of
    // public synthetic properties.
    const values = new Map();
    for (let obj = this; obj !== CommonBase.prototype; obj = Object.getPrototypeOf(obj)) {
      for (const n of Object.getOwnPropertyNames(obj)) {
        if (values.get(n) || /^_/.test(n)) {
          // It's either already been found (on a previous iteration) or it's
          // not a "public" property as defined by this project. (The `_` prefix
          // means it's effectively private or protected.)
          continue;
        }

        const desc = Object.getOwnPropertyDescriptor(obj, n);

        if (!desc.get) {
          // It's either not a synthetic property at all, or it's synthetic but
          // without a getter.
          continue;
        }

        // Call the getter, and add its `inspect()` result to the map of same.
        values.set(n, inspect(this[n], subOpts));
      }
    }

    // Sort the values by name, and use those to build up the final result.

    const sortedEntries = [...values].sort(([k1, v1_unused], [k2, v2_unused]) => {
      if (k1 < k2) {
        return -1;
      } else if (k1 > k2) {
        return 1;
      } else {
        return 0;
      }
    });

    const result = [name, ' { '];
    let   first  = true;

    for (const [k, v] of sortedEntries) {
      if (first) {
        first = false;
      } else {
        result.push(', ');
      }

      result.push(k);
      result.push(': ');
      result.push(v);
    }

    result.push(' }');
    return result.join('');
  }

  /**
   * Subclass-specifc implementation of `coerce()`. Subclasses can override this
   * as needed.
   *
   * @abstract
   * @param {*} value Value to coerce. This is guaranteed _not_ to be an
   *   instance of this class.
   * @returns {this} `value` or its coercion to the class that this was
   *   called on. Must always be an instance of the same as the class that this
   *   method was called on.
   */
  static _impl_coerce(value) {
    this._mustOverride(value);
  }

  /**
   * Subclass-specific implementation of `coerceOrNull()`. Subclasses can
   * override this as needed. The default implementation here simply calls
   * through to `_impl_coerce()` and converts any thrown exception into a `null`
   * return value.
   *
   * @param {*} value Value to coerce. This is guaranteed _not_ to be an
   *   instance of this class.
   * @returns {this|null} `value` or its coercion to the class that this was
   *   called on, or `null` if `value` can't be coerced. If non-null, will
   *   always be an instance of the same class that this method was called on.
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
  static _mustOverride(...args_unused) {
    throw Errors.badUse('Subclass must override this method.');
  }
}
