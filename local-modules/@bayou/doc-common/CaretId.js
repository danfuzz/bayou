// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Errors, Random, UtilityClass } from '@bayou/util-common';

/** {RexExp} Expression which matches caret IDs. */
const CARET_ID_REGEX = /^cr-[0-9a-z]{10}$/;

/**
 * Utility class for handling caret IDs (a/k/a session IDs). A caret ID is a
 * string that uniquely identifies an editing session within a given document.
 *
 * A valid ID consists of the prefix `cr-` followed by 10 lowercase alphanumeric
 * characters.
 */
export default class CaretId extends UtilityClass {
  /**
   * Validates that the given value is a valid caret ID string. Throws an
   * error if not.
   *
   * @param {*} value Value to check.
   * @returns {string} `value` if it is in fact a valid caret ID string.
   */
  static check(value) {
    if (CaretId.isInstance(value)) {
      return value;
    }

    throw Errors.badValue(value, CaretId);
  }

  /**
   * Indicates whether the given value is a valid caret ID string.
   *
   * @param {*} value Value in question.
   * @returns {boolean} `true` if `value` is indeed a valid caret ID string,
   *   or `false` if not.
   */
  static isInstance(value) {
    return (typeof value === 'string') && CARET_ID_REGEX.test(value);
  }

  /**
   * Constructs and returns a random caret ID string.
   *
   * @returns {string} A randomly-generated caret ID string.
   */
  static randomInstance() {
    return Random.idString('cr', 10);
  }
}
