// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/** Running in a browser? */
const IS_BROWSER = (typeof window !== 'undefined');

// Use `require` conditionally instead of just `import`ing, to avoid breaking
// the browser.
const util = IS_BROWSER ? null : require('util');

/**
 * Logger which associates a tag (typically a subsystem or module name) and a
 * severity level (info, warning, error, etc.) with all activity.
 */
export default class SeeAll {
  /** Severity level indicating a dire error. */
  static get ERR() { return 'err'; }

  /** Severity level indicating a warning. Trouble, but not dire. */
  static get WARN() { return 'warn'; }

  /** Severity level indicating general info. No problem, but maybe you care. */
  static get INFO() { return 'info'; }

  /** Severity level indicating temporary stuff for debugging. */
  static get DEBUG() { return 'debug'; }

  /**
   * Constructs an instance.
   *
   * @param tag Tag to associate with messages logged by this instance.
   * @returns The constructed logger.
   */
  constructor(tag) {
    this._tag = tag;
  }

  /**
   * Logs a message at the given severity level.
   *
   * @param level Severity level. Must be one of the severity level constants
   *   defined by this class.
   * @param message Message to log. If `message` is an object and we are running
   *   in a browser context, this will log the object such that the browser
   *   console can be used to inspect it. If `message` is an exception, this
   *   will log the stack trace.
   */
  log(level, message) {
    const prefix = `[${this._tag} ${level}]`;

    if (typeof message === 'object') {
      if (IS_BROWSER) {
        console.log(prefix, message);
        return;
      }
      message = util.inspect(message);
    } else if (typeof message !== 'string') {
      message = message.toString();
    }

    // Split on newlines, so we can prefix every line.
    const lines = message.match(/[^\n]*\n|[^\n]+$/g);
    for (let l of lines) {
      l = l.match(/[^\n]*/)[0]; // Strip trailing `\n` if any.
      console.log(`${prefix} ${l}`);
    }
  }

  /**
   * Logs a message at the `ERR` level.
   *
   * @param message Message to log.
   */
  err(message) {
    this.log(SeeAll.ERR, message);
  }

  /**
   * Logs a message at the `WARN` level.
   *
   * @param message Message to log.
   */
  warn(message) {
    this.log(SeeAll.WARN, message);
  }

  /**
   * Logs a message at the `INFO` level.
   *
   * @param message Message to log.
   */
  info(message) {
    this.log(SeeAll.INFO, message);
  }

  /**
   * Logs a message at the `DEBUG` level.
   *
   * @param message Message to log.
   */
  debug(message) {
    this.log(SeeAll.INFO, message);
  }
}
