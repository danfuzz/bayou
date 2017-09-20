// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase, Errors } from 'util-common';

import LogStream from './LogStream';

/** Set of valid severity levels. */
const LEVELS = new Set(['debug', 'error', 'warn', 'info', 'detail']);

/**
 * Base class for loggers. Subclasses must implement `_impl_log()`.
 */
export default class BaseLogger extends CommonBase {
  /**
   * Validates a logging severity level value. Throws an error if invalid.
   *
   * @param {string} level Severity level. Must be one of the severity level
   *   constants defined by this class.
   * @returns {string} `level`, if it is indeed valid.
   */
  static validateLevel(level) {
    if (!LEVELS.has(level)) {
      throw Errors.bad_value(level, 'logging severity level');
    }

    return level;
  }

  /**
   * Logs a message at the given severity level.
   *
   * @param {string} level Severity level. Must be one of the severity level
   *   constants defined by this class.
   * @param {...*} message Message to log. If any of the `message` values is an
   *   object and we are running in a browser context, this will log the object
   *   such that the browser console can be used to inspect it. If `message`
   *   contains an exception, this will log the stack trace.
   */
  log(level, ...message) {
    BaseLogger.validateLevel(level);
    this._impl_log(level, message);
  }

  /**
   * Logs a message at the `DEBUG` level.
   *
   * @param {...*} message Message to log. See `log()` for details.
   */
  debug(...message) {
    this.log('debug', ...message);
  }

  /**
   * Logs a message at the `ERROR` level.
   *
   * @param {...*} message Message to log. See `log()` for details.
   */
  error(...message) {
    this.log('error', ...message);
  }

  /**
   * Logs a message at the `WARN` level.
   *
   * @param {...*} message Message to log. See `log()` for details.
   */
  warn(...message) {
    this.log('warn', ...message);
  }

  /**
   * Logs a message at the `INFO` level.
   *
   * @param {...*} message Message to log. See `log()` for details.
   */
  info(...message) {
    this.log('info', ...message);
  }

  /**
   * Logs a message at the `DETAIL` level.
   *
   * @param {...*} message Message to log. See `log()` for details.
   */
  detail(...message) {
    this.log('detail', ...message);
  }

  /**
   * "What a terrible failure!" Logs a message at the `ERROR` level, indicating
   * a violation of an explicit or implied assertion. That is, this represents
   * a "shouldn't happen" condition that in fact was detected to have happened.
   * After so logging, this throws an exception, which is meant to cause the
   * system to shut down (and potentially restart, if it's set up to self-heal).
   *
   * @param {...*} message Message to log. See `log()` for details.
   */
  wtf(...message) {
    this.error('wtf', ...message);
    throw Errors.wtf(message.join(' '));
  }

  /**
   * Gets a writable stream which can be used to write logs at the indicated
   * level. The result only nominally implements the protocol. In particular,
   * it responds to both `.write()` and `.end()` identically, and it never
   * emits events.
   *
   * @param {string} level Severity level. Must be one of the severity level
   *   constants defined by this class.
   * @returns {LogStream} An appropriately-constructed stream.
   */
  streamFor(level) {
    BaseLogger.validateLevel(level);
    return new LogStream(this, level);
  }

  /** A writable stream for `debug` logs. */
  get debugStream() { return this.streamFor('debug'); }

  /** A writable stream for `error` logs. */
  get errorStream() { return this.streamFor('error'); }

  /** A writable stream for `warn` logs. */
  get warnStream() { return this.streamFor('warn'); }

  /** A writable stream for `info` logs. */
  get infoStream() { return this.streamFor('info'); }

  /** A writable stream for `detail` logs. */
  get detailStream() { return this.streamFor('detail'); }

  /**
   * Constructs and returns a wrapper for this instance which prefixes each
   * log with the given additional arguments.
   *
   * @param {...*} prefix Values to use as a prefix for all logged messages.
   * @returns {BaseLogger} A new logger which prefixes logs as indicated.
   */
  withPrefix(...prefix) {
    const result = new BaseLogger();

    result._impl_log = (level, message) => {
      this.log(level, ...prefix, ...message);
    };

    return result;
  }

  /**
   * Constructs and returns a wrapper for this instance which prefixes each
   * log with the results of calling the given prefix-generator function. The
   * function is called with no arguments and is expected to return an array.
   * The results of that call are used as the first message arguments to the
   * ultimate logging calls.
   *
   * @param {function} prefixGenerator Function to generate prefix arguments.
   * @returns {BaseLogger} A new logger which prefixes logs as indicated.
   */
  withDynamicPrefix(prefixGenerator) {
    const result = new BaseLogger();

    result._impl_log = (level, message) => {
      const prefix = prefixGenerator();
      this.log(level, ...prefix, ...message);
    };

    return result;
  }

  /**
   * Actual logging implementation. Subclasses must override this to do
   * something appropriate.
   *
   * @abstract
   * @param {string} level Severity level. Guaranteed to be a valid level.
   * @param {array} message Array of arguments to log.
   */
  _impl_log(level, message) {
    this._mustOverride(level, message);
  }
}
