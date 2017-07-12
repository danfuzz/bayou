// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt } from 'typecheck';
import { CommonBase } from 'util-common';

/**
 * Minimum (inclusive) acceptable timestamp `secs` value.
 *
 * ```
 * $ date -u -r 1010000000
 * Wed Jan  2 19:33:20 UTC 2002
 * ```
 */
const MIN_SECS = 1010000000;

/**
 * Maximum (exclusive) acceptable timestamp `secs` value.
 *
 * ```
 * $ date -u -r 2530000000
 * Fri Mar  4 09:46:40 UTC 2050
 * ```
 */
const MAX_SECS = 2530000000;

/** Number of microseconds in a second. */
const USECS_PER_SEC = 1000000;

/**
 * Microsecond-granularity timestamp. Timestamps are represented with two
 * components, a standard Unix-ish count of seconds since the "Unix Epoch" and
 * a whole number of microseconds.
 *
 * In addition, in order to help prevent bugs, the seconds component is
 * restricted to fall within a range of dates with a minimum around the start
 * of the year 2002 and a maximum around the start of the year 2050.
 */
export default class Timestamp extends CommonBase {
  /**
   * Constructs an instance from a millisecond-granularity time value, such as
   * might have been returned from `Date.now()`.
   *
   * @param {Int} msec Milliseconds since the Unix Epoch.
   * @returns {Timestamp} An appropriately-constructed instance of this class.
   */
  static fromMsec(msec) {
    TInt.check(msec);
    const secs = Math.floor(msec / 1000);
    const usecs = (msec - (secs * 1000)) * 1000;
    return new Timestamp(secs, usecs);
  }

  /**
   * Constructs an instance from the return value of `Date.now()`.
   *
   * @returns {Timestamp} An appropriately-constructed instance of this class.
   */
  static now() {
    return Timestamp.fromMsec(Date.now());
  }

  /**
   * Constructs an instance.
   *
   * @param {Int} secs Seconds since the Unix Epoch. Must be in the "reasonable"
   *   range as described in the class header.
   * @param {Int} usecs Additional microseconds. Must be a whole number less
   *   than 1000000.
   */
  constructor(secs, usecs) {
    super();

    /** Seconds since the Unix epoch. */
    this._secs = TInt.range(secs, MIN_SECS, MAX_SECS);

    /** Additional microseconds. */
    this._usecs = TInt.range(usecs, 0, USECS_PER_SEC);

    Object.freeze(this);
  }

  /** Name of this class in the API. */
  static get API_NAME() {
    return 'Timestamp';
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._secs, this._usecs];
  }

  /** The number of seconds since the Unix Epoch. */
  get secs() {
    return this._secs;
  }

  /** The additional microseconds. */
  get usecs() {
    return this._usecs;
  }

  /**
   * Returns a string form for this instance. This is always of the form
   * `<secs>.<usecs>` where `<usecs>` is always six digits long.
   *
   * @returns {string} The string form.
   */
  toString() {
    // A little cheeky, but this left-pads the usecs with zeroes.
    const usecs = ('' + (this._usecs + USECS_PER_SEC)).slice(1);

    return `${this._secs}.${usecs}`;
  }
}
