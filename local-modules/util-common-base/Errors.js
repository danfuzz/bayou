// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import util from 'util';

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
   * Constructs an instance which is meant to indicate that the program
   * exhibited unexpected behavior. This should be used as an indication of a
   * likely bug in the program.
   *
   * @param {*} message Human-oriented message with some indication of what
   *   went wrong. If not a string, gets converted to one via `util.inspect()`.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static wtf(message) {
    if (typeof message !== 'string') {
      message = util.inspect(message);
    }

    return new InfoError('wtf', message);
  }
}
