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
   * @param {*} value The bad value.
   * @param {string|function} expectedType Name of the expected type or a
   *   function whose name is the expected type.
   * @param {string|null} [extra = null] Extra information about the expected
   *   value.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static bad_value(value, expectedType, extra = null) {
    if (typeof expectedType === 'function') {
      expectedType = expectedType.name;
    }

    CoreTypecheck.checkString(expectedType);
    CoreTypecheck.checkStringOrNull(extra);

    return new InfoError(
      inspect(value),
      expectedType,
      ...((extra === null) ? [] : [extra]));
  }

  /**
   * Constructs an instance which is meant to indicate that the program
   * exhibited unexpected behavior. This should be used as an indication of a
   * likely bug in the program.
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
