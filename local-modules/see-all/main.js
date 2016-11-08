// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/** Running in a browser? */
const IS_BROWSER = (typeof window !== 'undefined');

/**
 * The actual logger to user. This uses `require` conditionally instead of just
 * `import`ing, to avoid breaking the browser. (That is, it would fail in
 * browser context if we imported the server code.)
 */
const LOGGER_CLASS =
  require(IS_BROWSER ? './LogBrowser' : './LogServer').default;
const THE_LOGGER = new LOGGER_CLASS();

/**
 * Set of valid severity levels (as a map from names to `true`).
 */
const LEVELS = {
  'debug':  true,
  'error':  true,
  'warn':   true,
  'info':   true,
  'detail': true
};

/**
 * Logger which associates a tag (typically a subsystem or module name) and a
 * severity level (`info`, `error`, etc.) with all activity. Stack traces are
 * included for any message logged at a level that indicates any sort of
 * problem.
 *
 * One severity level, `detail`, is squelchable and is in fact squelched by
 * default. The rest are not squelchable; see the comments on the level
 * constants for a more complete explanation.
 */
export default class SeeAll {
  /**
   * Severity level indicating temporary stuff for debugging. Code that uses
   * this level should not in general get checked into the repo.
   */
  static get DEBUG() { return 'debug'; }

  /**
   * Severity level indicating a dire error.  Logs at this level should indicate
   * something that went horribly awry, as opposed to just being a more
   * innocuous errory thing that normally happens from time to time, such as,
   * for example, a network connection that dropped unexpectedly.
   */
  static get ERROR() { return 'error'; }

  /**
   * Severity level indicating a warning. Trouble, but not dire. Logs at this
   * level should indicate something that is out-of-the-ordinary but not
   * unrecoverably so.
   */
  static get WARN() { return 'warn'; }

  /**
   * Severity level indicating general info. No problem, but maybe you care.
   * Logs at this level should come at a reasonably stately pace (maybe a couple
   * times a minute or so) and give a general sense of the healthy operation
   * of the system.
   */
  static get INFO() { return 'info'; }

  /**
   * Severity level indicating detailed operation. These might be used multiple
   * times per second, to provide a nuanced view into the operation of a
   * component. These logs are squelched by default, as they typically distract
   * from the big picture of the system. They are meant to be turned on
   * selectively during development and debugging.
   */
  static get DETAIL() { return 'detail'; }

  /**
   * Constructs an instance.
   *
   * @param tag Tag to associate with messages logged by this instance.
   * @param enableDetail (optional; default `false`) Whether or not to produce
   *   logs at the `detail` level.
   * @returns The constructed logger.
   */
  constructor(tag, enableDetail = false) {
    /** The module / subsystem tag. */
    this._tag = tag;

    /** Whether logging is enabled for the `detail` level. */
    this._enableDetail = enableDetail;
  }

  /**
   * Logs a message at the given severity level.
   *
   * @param level Severity level. Must be one of the severity level constants
   *   defined by this class.
   * @param ...message Message to log. If any of the `message` values is an
   *   object and we are running in a browser context, this will log the object
   *   such that the browser console can be used to inspect it. If `message` is
   *   an exception, this will log the stack trace.
   */
  log(level, ...message) {
    if (!LEVELS[level]) {
      throw new Error(`Invalid severity level: ${level}`);
    }

    if ((level === 'detail') && !this._enableDetail) {
      // This tag isn't listed as one to log at the `detail` level. (That is,
      // it's being squelched.)
      return;
    }

    THE_LOGGER.log(level, this._tag, ...message);
  }

  /**
   * Logs a message at the `DEBUG` level.
   *
   * @param ...message Message to log. See `log()` for details.
   */
  debug(...message) {
    this.log(SeeAll.DEBUG, ...message);
  }

  /**
   * Logs a message at the `ERROR` level.
   *
   * @param ...message Message to log. See `log()` for details.
   */
  error(...message) {
    this.log(SeeAll.ERROR, ...message);
  }

  /**
   * Logs a message at the `WARN` level.
   *
   * @param ...message Message to log. See `log()` for details.
   */
  warn(...message) {
    this.log(SeeAll.WARN, ...message);
  }

  /**
   * Logs a message at the `INFO` level.
   *
   * @param ...message Message to log. See `log()` for details.
   */
  info(...message) {
    this.log(SeeAll.INFO, ...message);
  }

  /**
   * Logs a message at the `DETAIL` level.
   *
   * @param ...message Message to log. See `log()` for details.
   */
  detail(...message) {
    this.log(SeeAll.DETAIL, ...message);
  }

  /**
   * "What a terrible failure!" Logs a message at the `ERROR` level, indicating
   * a violation of an explicit or implied assertion. That is, this represents
   * a "shouldn't happen" condition that in fact was detected to have happened.
   * After so logging, this throws an exception, which is meant to cause the
   * system to shut down (and potentially restart, if it's set up to self-heal).
   *
   * @param ...message Message to log. See `log()` for details.
   */
  wtf(...message) {
    this.error('Shouldn\'t happen:', ...message);
    throw new Error('shouldnt_happen');
  }
}
