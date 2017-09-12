// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Errors, UtilityClass } from 'util-core';

/**
 * Type checker for type `Class`. A "class" is simply a function that can be
 * used as an object constructor.
 *
 * **Note:** Unfortunately, JavaScript (a) is loosey-goosey about what sorts of
 * functions can be called as constructors, and (b) doesn't provide a way to
 * distinguish the various cases _except_ to look at the string conversion of
 * functions.
 */
export default class TClass extends UtilityClass {
  /**
   * Checks a value of type `Class`.
   *
   * @param {*} value The (alleged) class.
   * @returns {Class} `value`.
   */
  static check(value) {
    if (TClass.isInstance(value)) {
      return value;
    }

    throw Errors.bad_value(value, 'Class');
  }

  /**
   * Indicates whether the given value is of type `Class`.
   *
   * @param {*} value Value in question.
   * @returns {boolean} `true` if it is a class (per the description in the
   *   header), or `false` if not.
   */
  static isInstance(value) {
    if (   ((typeof value) !== 'function')
        || ((typeof value.constructor) !== 'function')) {
      return false;
    }

    const protoType = typeof value.prototype;

    // **Note:** The type of the prototype is `Function` for the class
    // `Function` itself.
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
}
