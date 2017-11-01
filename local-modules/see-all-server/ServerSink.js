// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import chalk from 'chalk';
import { format, inspect } from 'util';

import { BaseSink, Logger, SeeAll } from 'see-all';
import { TFunction } from 'typecheck';
import { ErrorUtil } from 'util-common';

// The whole point of this file is to use `console.<whatever>`, so...
/* eslint-disable no-console */

/** {Int} The minimum length of the prefix area, in characters/columns. */
const MIN_PREFIX_LENGTH = 20;

/**
 * {Int} The minimum increment to use for prefix length adjustment (so as to
 * avoid overly-sinuous alignment).
 */
const PREFIX_ADJUST_INCREMENT = 4;

/**
 * Implementation of the `see-all` logging sink protocol for use in a server
 * context. It logs everything to the console.
 */
export default class ServerSink extends BaseSink {
  /**
   * Registers an instance of this class as a logging sink with the main
   * `see-all` module. Also, optionally patches `console.log()` and friends to
   * call through to `see-all`, such that they will ultimately log to the
   * console via this class as well as getting logged with any other sink that's
   * hooked up (e.g. a {@link RecentSink}).
   *
   * @param {boolean} patchConsole If `true`, patches `console.log()` and
   *   friends.
   */
  static init(patchConsole) {
    const origConsoleLog = console.log;
    const log = (...args) => { origConsoleLog.apply(console, args); };

    SeeAll.theOne.add(new ServerSink(log));

    if (patchConsole) {
      const consoleLogger = new Logger('node-console');
      console.info  = (...args) => { consoleLogger.info(format(...args));  };
      console.warn  = (...args) => { consoleLogger.warn(format(...args));  };
      console.error = (...args) => { consoleLogger.error(format(...args)); };
      console.log   = console.info;
    }
  }

  /**
   * Constructs an instance.
   *
   * @param {function} log Function to call to actually perform logging. Must
   *   be call-compatible with (and will often actually be) `console.log()`.
   */
  constructor(log) {
    super();

    /** {function} Function to call to actually perform logging. */
    this._log = TFunction.checkCallable(log);

    /**
     * {Int} Number of columns currently being reserved for log line prefixes.
     * This starts with a reasonable guess (to avoid initial churn) and gets
     * updated in {@link #_makePrefix()}.
     */
    this._prefixLength = MIN_PREFIX_LENGTH;

    /**
     * {Int} The maximum prefix observed over the previous
     * {@link #_recentLineCount} lines. This gets updated in
     * {@link #_makePrefix()}.
     */
    this._recentMaxPrefix = 0;

    /**
     * {Int} The number of lines in the reckoning recorded by
     * {@link #_recentMaxPrefix} lines. This gets updated in
     * {@link #_makePrefix()}.
     */
    this._recentLineCount = 0;
  }

  /**
   * Logs a message at the given severity level.
   *
   * @param {Int} nowMsec_unused Timestamp of the message.
   * @param {string} level Severity level.
   * @param {string} tag Name of the component associated with the message.
   * @param {...*} message Message to log.
   */
  log(nowMsec_unused, level, tag, ...message) {
    const prefix = this._makePrefix(tag, level);

    // Make a unified string of the entire message.
    let text = '';
    let atLineStart = true;
    let gotError = false;
    for (let m of message) {
      if (typeof m === 'object') {
        if (m instanceof Error) {
          gotError = true; // Used after the `for` loop, below.
        }

        // Convert the object to a string. If it's a single line, just add it
        // to the text inline. If it's multiple lines, make sure it all ends up
        // on its own lines.
        m = inspect(m);
        if (/\n/.test(m)) {
          text += `${atLineStart ? '' : '\n'}${m}\n`;
          atLineStart = true;
        } else {
          text += `${atLineStart ? '' : ' '}${m}`;
          atLineStart = false;
        }
      } else {
        text += `${atLineStart ? '' : ' '}${m}`;
        atLineStart = (typeof m === 'string') ? /\n$/.test(m) : false;
      }
    }

    if (!gotError && (level !== 'detail') && (level !== 'info')) {
      // It's at a level that warrants a stack trace, and none of the arguments
      // is an `Error`. So, append one. We drop the initial set of stack lines
      // coming from the logging module.
      const trace = ErrorUtil.stackLines(new Error());
      let   skip  = true;
      for (const line of trace) {
        if (skip && !/[/]see-all/.test(line)) {
          skip = false;
        }
        if (!skip) {
          text += `\n  ${line}`;
        }
      }
    }

    // Remove the trailing newline, if any, and split on newlines to produce an
    // array of all lines. The final-newline removal means we won't (typically)
    // have an empty line at the end of the log.
    const lines = text.replace(/\n$/, '').match(/^.*$/mg);

    // Measure every line. If all lines are short enough for the current
    // console, align them to the right of the prefix. If not, put the prefix on
    // its own line and produce the main content just slightly indented, under
    // the prefix.

    const consoleWidth = ServerSink._consoleWidth();
    const maxLineWidth = lines.reduce(
      (prev, l) => { return Math.max(prev, l.length); },
      0);

    if (maxLineWidth > (consoleWidth - this._prefixLength)) {
      this._log(prefix);
      for (let l of lines) {
        let indent = '  ';

        while (l) {
          const chunk = l.substring(0, consoleWidth - indent.length);
          l = l.substring(chunk.length);
          this._log(`${indent}${chunk}`);
          indent = '+ ';
        }
      }
    } else {
      const spaces = ' '.repeat(this._prefixLength);
      let   first  = true;

      for (const l of lines) {
        this._log(`${first ? prefix : spaces}${l}`);
        first = false;
      }
    }
  }

  /**
   * Logs the indicated time value as "punctuation" on the log.
   *
   * @param {Int} nowMsec_unused Timestamp to log.
   * @param {string} utcString String representation of the time, as UTC.
   * @param {string} localString String representation of the time, in the local
   *   timezone.
   */
  time(nowMsec_unused, utcString, localString) {
    utcString = chalk.blue.bold(utcString);
    localString  = chalk.blue.dim.bold(localString);
    const prefix = this._makePrefix('time');

    this._log(`${prefix}${utcString} / ${localString}`);
  }

  /**
   * Constructs a prefix header with the given tag (required) and level
   * (optional). Also updates the instance fields that track the observed
   * prefix lengths.
   *
   * @param {string} tag The component tag.
   * @param {string} [level = ''] The severity level.
   * @returns {string} The prefix, including coloring and padding.
   */
  _makePrefix(tag, level = '') {
    const levelStr = ((level === 'info') || (level === '')) ? '' : ` ${level[0].toUpperCase()}`;
    let   text     = `[${tag}${levelStr}]`;
    const length   = text.length + 1; // `+1` for the space at the end.

    // Color the prefix according to level.
    switch (level) {
      case 'error': { text = chalk.red.bold(text);    break; }
      case 'warn':  { text = chalk.yellow.bold(text); break; }
      default:      { text = chalk.dim.bold(text);    break; }
    }

    // Update the prefix length instance variables. What we're doing here is
    // adjusting the prefix area to be wider when we discover a prefix which
    // would be longer than what we've seen before. At the same time, we record
    // a recently-observed maximum, and we reset to that from time to time. The
    // latter prevents brief "prefix blow-outs" from permanently messing with
    // the log output.
    const MIN    = MIN_PREFIX_LENGTH;
    const ADJUST = PREFIX_ADJUST_INCREMENT;
    const prefixLength = (length <= MIN)
      ? MIN
      : Math.ceil((length - MIN) / ADJUST) * ADJUST + MIN;
    this._prefixLength    = Math.max(this._prefixLength,    prefixLength);
    this._recentMaxPrefix = Math.max(this._recentMaxPrefix, prefixLength);
    this._recentLineCount++;
    if (this._recentLineCount >= 100) {
      this._prefixLength = this._recentMaxPrefix;
      this._recentMaxPrefix = 0;
      this._recentLineCount = 0;
    }

    // Right-pad with spaces. This is designed to always add at least one space
    // (so there is always at least one between the prefix and main log
    // content).
    text += ' '.repeat(this._prefixLength - length + 1);

    return text;
  }

  /**
   * Figures out the width of the console (if attached) or a reasonable default
   * if not.
   *
   * @returns {number} The console width.
   */
  static _consoleWidth() {
    if (!process.stdout.isTTY) {
      return 80;
    }

    return Math.max(process.stdout.getWindowSize()[0] || 80, 80);
  }
}
