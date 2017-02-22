// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import inspect from 'object-inspect';

/**
 * Error subclass for problems reported by this module, meant also to be used
 * by other modules providing similar functionality.
 */
export default class TypeError extends Error {
  /**
   * Constructs an instance.
   *
   * @param {string|null} [msg = null] Error message.
   */
  constructor(msg = null) {
    super(msg);
  }

  /**
   * Throws an error indicating a bad value, including the expected type and
   * representation of the value.
   *
   * @param {*} value The bad value.
   * @param {string} typeName Name of the expected type.
   * @param {string|null} [extra = null] Extra info about the expected value.
   */
  static badValue(value, typeName, extra = null) {
    const rep = inspect(value);

    extra = (extra === null) ? '' : `, ${extra}`;
    throw new TypeError(`Expected value of type \`${typeName}\`${extra}. Got \`${rep}\`.`);
  }
}
