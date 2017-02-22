// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt, TypeError } from 'typecheck';

/**
 * Minimum acceptable timestamp value.
 *
 * ```
 * $ date -u -r 1010000000
 * Wed Jan  2 19:33:20 UTC 2002
 * ```
 */
const MIN_TIME_MSEC = 1010000000 * 1000;

/**
 * Maximum acceptable timestamp value.
 *
 * ```
 * $ date -u -r 2530000000
 * Fri Mar  4 09:46:40 UTC 2050
 * ```
 */
const MAX_TIME_MSEC = 2530000000 * 1000;

/**
 * Microsecond-granularity timestamp. Timestamps are represented with two
 * components, a standard Unix-ish count of seconds since the "Unix Epoch" and
 * a whole number of microseconds.
 *
 * In addition, in order to help prevent bugs, the seconds component is
 * restricted to fall within a range of dates with a minimum around the start
 * of the year 2002 and a maximum around the start of the year 2050.
 */
export default class Timestamp {
  /**
   * Checks a value of type `Timestamp`. These are integer counts of milliseconds
   * since the Unix Epoch, with a minimum value set to be around the start of
   * 2008.
   *
   * @param {*} value Value to check.
   * @returns {number} `value`.
   */
  static check(value) {
    try {
      return TInt.rangeInc(value, MIN_TIME_MSEC, MAX_TIME_MSEC);
    } catch (e) {
      // More appropriate error.
      return TypeError.badValue(value, 'Timestamp');
    }
  }
}
