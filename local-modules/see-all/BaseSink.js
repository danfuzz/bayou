// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { CommonBase, ErrorUtil } from 'util-common';

/**
 * Base class for logging sink. Subclasses must implement `log()` and `time()`.
 *
 * **TODO:** This should follow the usual abstract class pattern and make the
 * methods to implement be named `_impl_*`.
 */
export default class BaseSink extends CommonBase {
  /**
   * Returns a string form for the given value, suitable for logging. Among
   * other things:
   *
   * * It leaves strings as-is (doesn't quote them), on the assumption that
   *   they are meant to be literal text.
   * * It tries to make a high-fidelity string given an `Error`, including the
   *   message, the stack trace, and any "causes" (if it happens to be an
   *   {@link InfoError}).
   * * Result-initial newlines are stripped (if they would otherwise be
   *   present).
   * * For a single-line result, all result-final newlines are stripped.
   * * For a multi-line result, exactly one result-final newline is included.
   *
   * @param {*} value Value to convert.
   * @returns {string} String form of `value`.
   */
  static inspectValue(value) {
    let raw;
    if (typeof value === 'string') {
      raw = value;
    } else if (value instanceof Error) {
      raw = ErrorUtil.fullTrace(value);
    } else {
      raw = inspect(value);
    }

    // Trim off initial and trailing newlines.
    const trimmed = raw.replace(/(^\n+|\n+$)/g, '');

    return /\n/.test(trimmed) ? `${trimmed}\n` : trimmed;
  }

  /**
   * Constructs a standard-form prefix string for the given level and tag.
   *
   * @param {string} level Severity level. Ignored if `tag === 'time'`.
   * @param {string} tag Name of the component associated with the message.
   * @returns {string} The constructed prefix string.
   */
  static makePrefix(level, tag) {
    const levelStr = ((level === 'info') || (level === ''))
      ? ''
      : ` ${level[0].toUpperCase()}`;

    return `[${tag}${levelStr}]`;
  }

  /**
   * "Stringifies" message arguments. Given a list of arguments as originally
   * passed to `log()` (or similar), returns the preferred unified string form.
   * This concatenates all arguments, separating single-line arguments from
   * each other with a single space, and newline-separating multi-line arguments
   * (so that each ends up on its own line).
   *
   * @param {...*} message Original message arguments.
   * @returns {string} Unified string form.
   */
  static stringifyMessage(...message) {
    // For any items in `message` that aren't strings, use `inspect()` to
    // stringify them.
    message = message.map(x => BaseSink.inspectValue(x));

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
