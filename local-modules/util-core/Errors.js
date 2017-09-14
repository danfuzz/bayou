// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import CoreTypecheck from './CoreTypecheck';
import InfoError from './InfoError';
import UtilityClass from './UtilityClass';

/**
 * Utility class for constructing commonly-used errors, which are applicable to
 * a wide variety of code.
 *
 * **Note:** The names of the methods match the error functor names, and because
 * the convention for those is `lowercase_underscore`, that is what's used.
 */
export default class Errors extends UtilityClass {
  /**
   * Constructs an instance which indicates that an improper value was passed
   * as an argument to a function (or similar). The error includes a description
   * (typically pseudocode-ish) of the expected type of value.
   *
   * This error is typically used to report an error that crosses a line of
   * responsibility, e.g. to report that a user of a class or module is breaking
   * the contract by passing an out-of-spec value.
   *
   * @param {*} value The bad value.
   * @param {string|function} expectedType Name of the expected type or a
   *   function (presumably a constructor/class) whose name is the expected
   *   type.
   * @param {string|null} [extra = null] Extra information about the expected
   *   value.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static bad_value(value, expectedType, extra = null) {
    if (typeof expectedType === 'string') {
      // All good. No extra checks.
    } else if (   (typeof expectedType === 'function')
               && (typeof expectedType.name === 'string')) {
      expectedType = expectedType.name;
    } else {
      // Hail mary, to try to get something useful out of `expectedType` (even
      // though it wasn't passed as a valid value per the docs).
      expectedType = inspect(expectedType);
    }

    CoreTypecheck.checkStringOrNull(extra);

    return new InfoError(
      'bad_value',
      inspect(value),
      expectedType,
      ...((extra === null) ? [] : [extra]));
  }

  /**
   * Constructs an instance which is meant to indicate that the program
   * exhibited unexpected behavior. This should be used as an indication of a
   * likely bug in the program.
   *
   * This error is typically used to report an error that _does not_ cross a
   * line of responsibility. That is, it is intended to convey that the code at
   * the point of failure "believed" it was being used properly and yet still
   * ran into unexpected trouble. In other systems, you might see something like
   * `throw new Error("Shouldn't happen.")` in this sort of situation.
   *
   * To be clear, this is _not_ an appropriate error to use to report "possible
   * but still unusual and noteworthy" problems such as network failure.
   *
   * @param {*} message Human-oriented message with some indication of what
   *   went wrong.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static wtf(message) {
    CoreTypecheck.checkString(message);

    return new InfoError('wtf', message);
  }
}
