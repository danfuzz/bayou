// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { CommonBase } from 'util-common';

/**
 * Base class for logging sink. Subclasses must implement `log()` and `time()`.
 *
 * **TODO:** This should follow the usual abstract class pattern and make the
 * methods to implement be named `_impl_*`.
 */
export default class BaseSink extends CommonBase {
  /**
   * "Stringifies" message arguments. Given a list of arguments as originally
   * passed to `log()` (or similar), returns the preferred unified string form.
   *
   * @param {...*} message Original message arguments.
   * @returns {string} Unified string form.
   */
  static stringifyMessage(...message) {
    // For any items in `message` that aren't strings, use `inspect()` to
    // stringify them.
    message = message.map((x) => {
      return (typeof x === 'string') ? x : inspect(x);
    });

    // Join the arguments together with spaces, et voila!
    return message.join(' ');
  }

  /**
   * Logs a message at the given severity level.
   *
   * @abstract
   * @param {Int} nowMsec Timestamp of the message.
   * @param {string} level Severity level.
   * @param {string} tag Name of the component associated with the message.
   * @param {...*} message Message to log.
   */
  log(nowMsec, level, tag, ...message) {
    this._mustOverride(nowMsec, level, tag, message);
  }

  /**
   * Logs the indicated time value as "punctuation" on the log. This class
   * also uses this call to trigger cleanup of old items.
   *
   * @abstract
   * @param {Int} nowMsec Timestamp to log.
   * @param {string} utcString String representation of the time, as UTC.
   * @param {string} localString String representation of the time, in the local
   *   timezone.
   */
  time(nowMsec, utcString, localString) {
    this._mustOverride(nowMsec, utcString, localString);
  }
}
