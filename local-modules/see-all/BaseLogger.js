// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase, Errors } from 'util-common';

import LogRecord from './LogRecord';
import LogStream from './LogStream';
import LogTag from './LogTag';


/**
 * Base class for loggers. Subclasses must implement `_impl_logMessage()`.
 */
export default class BaseLogger extends CommonBase {
  /**
   * Logs an ad-hoc human-oriented message at the given severity level.
   *
   * @param {string} level Severity level. Must be one of the severity level
   *   constants defined by this class.
   * @param {...*} message Message to log. If any of the `message` values is an
   *   object and we are running in a browser context, this will log the object
   *   such that the browser console can be used to inspect it. If `message`
   *   contains an exception, this will log the stack trace.
   */
  logMessage(level, ...message) {
    LogRecord.checkMessageLevel(level);
    this._impl_logMessage(level, message);
  }

  /**
   * Logs an ad-hoc message at the `debug` level.
   *
   * @param {...*} message Message to log. See {@link #logMessage} for details.
   */
  debug(...message) {
    this.logMessage('debug', ...message);
  }

  /**
   * Logs an ad-hoc message at the `detail` level.
   *
   * @param {...*} message Message to log. See `log()` for details.
   */
  detail(...message) {
    this.logMessage('detail', ...message);
  }

  /**
   * Logs an ad-hoc message at the `error` level.
   *
   * @param {...*} message Message to log. See {@link #logMessage} for details.
   */
  error(...message) {
    this.logMessage('error', ...message);
  }

  /**
   * Logs an ad-hoc message at the `info` level.
   *
   * @param {...*} message Message to log. See {@link #logMessage} for details.
   */
  info(...message) {
    this.logMessage('info', ...message);
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
    return new LogStream(this, level);
  }

  /**
   * Logs an ad-hoc message at the `warn` level.
   *
   * @param {...*} message Message to log. See {@link #logMessage} for details.
   */
  warn(...message) {
    this.logMessage('warn', ...message);
  }

  /**
   * Constructs and returns an instance just like this one, except with a tag
   * that has the given additional context.
   *
   * @param {...string} context Additional context strings. Each must be valid
   *   per the definition of context in {@link LogTag}.
   * @returns {BaseLogger} An appropriately-constructed instance of this class.
   */
  withAddedContext(...context) {
    for (const c of context) {
      LogTag.checkContextString(c);
    }

    return this._impl_withAddedContext(...context);
  }

  /**
   * "What a terrible failure!" Logs an ad-hoc message at the `error` level,
   * indicating a violation of an explicit or implied assertion. That is, this
   * represents a "shouldn't happen" condition that in fact was detected to have
   * happened. After so logging, this throws an exception, which is meant to
   * cause the system to shut down (and potentially restart, if it's set up to
   * self-heal).
   *
   * @param {...*} message Message to log. See {@link #logMessage} for details.
   */
  wtf(...message) {
    this.error('wtf', ...message);
    throw Errors.wtf(message.join(' '));
  }

  /**
   * Subclass-specific logging implementation.
   *
   * @abstract
   * @param {string} level Severity level. Guaranteed to be a valid level.
   * @param {array} message Array of arguments to log.
   */
  _impl_logMessage(level, message) {
    this._mustOverride(level, message);
  }

  /**
   * Subclass-specific context adder.
   *
   * @abstract
   * @param {...string} context Additional context strings. Guaranteed to be
   *   valid.
   * @returns {BaseLogger} An appropriately-constructed instance of this class.
   */
  _impl_withAddedContext(...context) {
    this._mustOverride(context);
  }
}
