// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt } from 'typecheck';
import { CommonBase } from 'util-common';

/**
 * {Int} Minimum (inclusive) acceptable timestamp `secs` value.
 *
 * ```
 * $ date -u -r 1010000000
 * Wed Jan  2 19:33:20 UTC 2002
 * ```
 */
const MIN_SECS = 1010000000;

/**
 * {Int} Maximum (exclusive) acceptable timestamp `secs` value.
 *
 * ```
 * $ date -u -r 2530000000
 * Fri Mar  4 09:46:40 UTC 2050
 * ```
 */
const MAX_SECS = 2530000000;

/** {Int} Number of microseconds in a second. */
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
    return Timestamp.fromUsec(msec * 1000);
  }

  /**
   * Constructs an instance from a microsecond-granularity time value.
   *
   * @param {Int} usec Microseconds since the Unix Epoch.
   * @returns {Timestamp} An appropriately-constructed instance of this class.
   */
  static fromUsec(usec) {
    const [secs, usecs] = Timestamp._splitUsecs(usec);
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

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._secs, this._usecs];
  }

  /** {Int} The number of seconds since the Unix Epoch. */
  get secs() {
    return this._secs;
  }

  /**
   * {Int} The additional microseconds. This is always a value in the range
   * `[0..999999]`.
   */
  get usecs() {
    return this._usecs;
  }

  /**
   * Adds the indicated number of msec to this instance's value, returning a new
   * instance.
   *
   * @param {Int} addMsec Amount to add. It can be negative.
   * @returns {Timestamp} An appropriately-constructed instance.
   */
  addMsec(addMsec) {
    TInt.check(addMsec);
    return this.addUsec(addMsec * 1000);
  }

  /**
   * Adds the indicated number of usec to this instance's value, returning a new
   * instance.
   *
   * @param {Int} addUsec Amount to add.
   * @returns {Timestamp} An appropriately-constructed instance.
   */
  addUsec(addUsec) {
    TInt.check(addUsec);

    let [secs, usecs] = Timestamp._splitUsecs(addUsec);

    secs  += this._secs;
    usecs += this._usecs;

    // Bump up `secs` if `usecs` overflows. **Note:** `_splitUsecs()` always
    // returns non-negative values for `usecs`, therefore we don't need to check
    // for underflow.
    if (usecs >= USECS_PER_SEC) {
      usecs -= USECS_PER_SEC;
      secs++;
    }

    return new Timestamp(secs, usecs);
  }

  /**
   * Compares this to another instance, returning the usual integer result of
   * comparison.
   *
   * @param {Timestamp} other Timestamp to compare to.
   * @returns {Int} `0` if the two have equal values; `-1` if this instance
   *   comes before `other`; or `1` if this instance comes after `other`.
   */
  compareTo(other) {
    Timestamp.check(other);

    let thisValue  = this._secs;
    let otherValue = other._secs;

    if (thisValue === otherValue) {
      // Seconds match, so compare based on usecs.
      thisValue  = this._usecs;
      otherValue = other._usecs;
    }

    if (thisValue === otherValue) {
      return 0;
    } else if (thisValue < otherValue) {
      return -1;
    } else {
      return 1;
    }
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

  /**
   * Splits a microseconds time value (either absolute or relative) into
   * separate seconds and microseconds values. If given a negative value, the
   * resulting `secs` will be negative, but `usecs` will always be non-negative.
   *
   * @param {Int} fullUsecs Microseconds since the Unix Epoch.
   * @returns {array<Int>} A two element array of `[secs, usecs]`.
   */
  static _splitUsecs(fullUsecs) {
    TInt.check(fullUsecs);

    const secs = Math.floor(fullUsecs / USECS_PER_SEC);
    const usecs = fullUsecs - (secs * USECS_PER_SEC);

    return [secs, usecs];
  }
}
