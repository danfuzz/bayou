// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Errors, UtilityClass } from 'util-core';

/**
 * Type checker for type `Function`.
 */
export default class TFunction extends UtilityClass {
  /**
   * Checks a value of type `Function`.
   *
   * @param {*} value The (alleged) function.
   * @returns {function} `value`.
   */
  static check(value) {
    if (typeof value !== 'function') {
      throw Errors.bad_value(value, Function);
    }

    return value;
  }

  /**
   * Checks a value of type `Function` which furthermore must be directly
   * callable.
   *
   * **Note:** See the documentation for {@link #isCallable} for details about
   * the check.
   *
   * @param {*} value The (alleged) class / constructor.
   * @returns {function} `value`, if it is indeed a class / constructor.
   */
  static checkCallable(value) {
    if (TFunction.isCallable(value)) {
      return value;
    }

    throw Errors.bad_value(value, Function, 'callable');
  }

  /**
   * Checks a value of type `Function` which furthermore must be usable as a
   * "class," that is, as a constructor function.
   *
   * **Note:** See the documentation for {@link #isClass} for details about the
   * check.
   *
   * @param {*} value The (alleged) class / constructor.
   * @returns {function} `value`, if it is indeed a class / constructor.
   */
  static checkClass(value) {
    if (TFunction.isClass(value)) {
      return value;
    }

    throw Errors.bad_value(value, Function, 'class');
  }

  /**
   * Indicates whether the given value is a function which is furthermore usable
   * for direct function calls. The type name notwithstanding, in JavaScript
   * some "functions" can't actually be called (they can only be used as
   * constructors).
   *
   * **Note:** Unfortunately, JavaScript (a) is loosey-goosey about what sorts
   * of functions can be called, and (b) doesn't provide a way
   * to distinguish the various cases _except_ to look at the string conversion
   * of functions. This method errs on the side of over-acceptance.
   *
   * @param {*} value Value in question.
   * @returns {boolean} `true` if it is a callable function, or `false` if
   *   not.
   */
  static isCallable(value) {
    if ((typeof value) !== 'function') {
      return false;
    }

    // It's a function. Now we need to know if it's callable by looking at the
    // string form. The only variant that is definitely _not_ callable is a
    // modern class, which will have the prefix `class ` (with a space).
    //
    // **Note:** We call the `toString()` of the `Function` prototype, to avoid
    // getting fooled by functions that override that method.

    const s = Function.prototype.toString.call(value);
    return !(/^class /.test(s));
  }

  /**
   * Indicates whether the given value is a function which is furthermore usable
   * as a "class," that is, whether it is a constructor function.
   *
   * **Note:** Unfortunately, JavaScript (a) is loosey-goosey about what sorts
   * of functions can be used as constructors, and (b) doesn't provide a way
   * to distinguish the various cases _except_ to look at the string conversion
   * of functions. This method errs on the side of over-acceptance.
   *
   * @param {*} value Value in question.
   * @returns {boolean} `true` if it is a class / constructor, or `false` if
   *   not.
   */
  static isClass(value) {
    if (   ((typeof value) !== 'function')
        || ((typeof value.constructor) !== 'function')) {
      return false;
    }

    // **Note:** The type of the prototype is `function` for the class
    // `Function` itself.
    const protoType = typeof value.prototype;
    if ((protoType !== 'object') && (protoType !== 'function')) {
      return false;
    }

    if (value.prototype.constructor !== value) {
      return false;
    }

    // At this point, we know we have a function whose `constructor` and
    // `prototype` have the right basic shape to be a class. However, the mere
    // existence of a `constructor` property doesn't make it a class. We still
    // have to inspect the string to make that determination. Specifically:
    //
    // * The prefix `class ` (with a space) indicates a class as defined via the
    //   modern `class` syntax.
    // * The prefix `function ` (with a space) indicates a function defined via
    //   the original `function` syntax. In this case, there is no hard
    //   guarantee that it's actually a class (it might just be a plain
    //   function), but JavaScript provides no introspective way to
    //   differentiate the cases.
    //
    // **Note:** We call the `toString()` of the `Function` prototype, to avoid
    // getting fooled by functions that override that method.

    const s = Function.prototype.toString.call(value);
    return /^(class|function) /.test(s);
  }

  /**
   * Checks a value which must either be of type `Function` or the exact value
   * `null`.
   *
   * @param {*} value Value to check.
   * @returns {function|null} `value`.
   */
  static orNull(value) {
    if ((value !== null) && (typeof value !== 'function')) {
      throw Errors.bad_value(value, 'Function|null');
    }

    return value;
  }
}
