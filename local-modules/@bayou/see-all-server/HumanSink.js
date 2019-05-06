// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import chalk from 'chalk';
import fs from 'fs';
import stringLength from 'string-length';
import stripAnsi from 'strip-ansi';
import { format, inspect } from 'util';
import wrapAnsi from 'wrap-ansi';

import { BaseSink, Logger, SeeAll } from '@bayou/see-all';
import { TBoolean, TString } from '@bayou/typecheck';

import { Redactor } from './Redactor';

/**
 * {Int} Default width of output, in columns. This is used when _not_ outputting
 * to an actual console or when the width of the console cannot be determined.
 */
const DEFAULT_CONSOLE_WIDTH = 120;

/** {Int} Minimum width of output, in columns. */
const MIN_CONSOLE_WIDTH = 80;

/** {Int} The minimum length of the prefix area, in characters/columns. */
const MIN_PREFIX_LENGTH = 16;

/**
 * {Int} The minimum increment to use for prefix length adjustment (so as to
 * avoid overly-sinuous alignment).
 */
const PREFIX_ADJUST_INCREMENT = 4;

/**
 * {Int} Maximum allowed length of an untruncated structured event string, in
 * characters.
 */
const MAX_EVENT_STRING_LENGTH = 500;

/**
 * Implementation of the `@bayou/see-all` logging sink protocol which writes
 * logs in a human-friendly text form to one or both of (a) a file and (b) the
 * console.
 */
export class HumanSink extends BaseSink {
  /**
   * Patches `console.log()` and friends to call through to `@bayou/see-all`,
   * such that they end up emitting log records and thus ultimately cause
   * logging to an instance of this class (if attached) as well as whatever
   * other logging sinks are hooked up (e.g. and likely, a {@link RecentSink}).
   */
  static patchConsole() {
    const consoleLogger = new Logger('node-console');

    /* eslint-disable no-console */
    console.info  = (...args) => { consoleLogger.info(format(...args));  };
    console.warn  = (...args) => { consoleLogger.warn(format(...args));  };
    console.error = (...args) => { consoleLogger.error(format(...args)); };
    console.log   = console.info;
    /* eslint-enable no-console */
  }

  /**
   * Constructs an instance.
   *
   * @param {string|null} path Path of the file to log to, or `null` to not
   *   write to a file.
   * @param {boolean} useConsole If `true`, also write logs to the console.
   *   (Technically, write to `process.stdout`.)
   */
  constructor(path, useConsole) {
    super();

    /**
     * {string|null} Path of the file to log to, or `null` if this instance is
     * not writing a file.
     */
    this._path = (path === null) ? null : TString.nonEmpty(path);

    /**
     * {boolean} Whether or not to write logs to the console (`process.stdout`,
     * really).
     */
    this._useConsole = TBoolean.check(useConsole);

    // Chalk markup level. See description below.
    const chalkLevel = (path === null)
      ? chalk.level
      : Math.max(useConsole ? chalk.level : 1, 1);

    /**
     * {Chalk} Chalk instance to use. This is a private instance (not the global
     * `chalk`). Moreover, if this class is set up to write to a file, the
     * instance supports at least minimal color, because we always want the file
     * output to be colorized.
     */
    this._chalk = new chalk.constructor({ level: chalkLevel });

    /** {boolean} When writing to the console, should color be stripped? */
    this._stripConsoleColor = useConsole && (chalk.level === 0);

    /**
     * {Int} Number of columns currently being reserved for log line prefixes.
     * This starts with a reasonable guess (to avoid initial churn) and gets
     * updated in {@link #_makePrefix}.
     */
    this._prefixLength = MIN_PREFIX_LENGTH;

    /**
     * {Int} The maximum prefix observed over the previous
     * {@link #_recentLineCount} lines. This gets updated in
     * {@link #_makePrefix}.
     */
    this._recentMaxPrefix = 0;

    /**
     * {Int} The number of lines in the reckoning recorded by
     * {@link #_recentMaxPrefix} lines. This gets updated in
     * {@link #_makePrefix}.
     */
    this._recentLineCount = 0;

    SeeAll.theOne.add(this);
  }

  /**
   * Writes a log record to the console.
   *
   * @param {LogRecord} logRecord The record to write.
   */
  _impl_sinkLog(logRecord) {
    logRecord = Redactor.redact(logRecord);

    const ck         = this._chalk;
    const prefix     = this._makePrefix(logRecord);
    const metricName = logRecord.metricName;

    // Make a unified string of the entire message.

    let text;
    if (logRecord.isTime()) {
      text = this._timeString(logRecord);
    } else if (metricName !== null) {
      const args  = logRecord.payload.args;
      const label = `${metricName}${(args.length === 0) ? '' : ': '}`;
      let   argString;

      switch (args.length) {
        case 0:  { argString = '';               break; }
        case 1:  { argString = inspect(args[0]); break; }
        default: { argString = inspect(args);    break; }
      }

      text = `${ck.hex('#503').bold(label)}${argString}`;
    } else if (logRecord.isEvent()) {
      text = logRecord.messageString;

      if (text.length > MAX_EVENT_STRING_LENGTH) {
        text = text.slice(0, MAX_EVENT_STRING_LENGTH);

        const lines = text.split('\n');
        if (lines.length === 1) {
          text += '...';
        } else {
          // Replace the last (and presumed partial) line with an ellipsis,
          // indented to match the second-to-last line.
          const indent = lines[lines.length - 2].match(/^ */)[0];
          lines[lines.length - 1] = `${indent}...`;
          text = lines.join('\n');
        }
      }

      text = ck.hex('#430').bold(text);
    } else {
      // It's an ad-hoc message.
      text = logRecord.messageString;
    }

    // Remove the trailing newline, if any, and split on newlines to produce an
    // array of all lines. The final-newline removal means we won't (typically)
    // have an empty line at the end of the log.
    const lines = text.replace(/\n$/, '').match(/^.*$/mg);

    // Measure every line. If all lines are short enough for the current
    // console, align them to the right of the prefix. If not, put the prefix on
    // its own line and produce the main content just slightly indented, under
    // the prefix. **Note:** `stringLength()` takes into account the fact that
    // ANSI color escapes don't add to the visual-length of a string.

    const consoleWidth = this._consoleWidth();
    const maxLineWidth = lines.reduce(
      (prev, l) => { return Math.max(prev, stringLength(l)); },
      0);

    if (maxLineWidth > (consoleWidth - this._prefixLength)) {
      this._write(`${prefix}\n`);

      const firstIndent = '  ';
      const restIndent  = '+ ';
      const wrapWidth   = consoleWidth - firstIndent.length;

      for (const l of lines) {
        const wrappedLine = wrapAnsi(l, wrapWidth, { hard: true, trim: false });

        let first = true;
        for (const chunk of wrappedLine.split('\n')) {
          this._write(`${first ? firstIndent : restIndent}${chunk}\n`);
          first = false;
        }
      }
    } else {
      const spaces = ' '.repeat(this._prefixLength);
      let   first  = true;

      for (const l of lines) {
        this._write(`${first ? prefix : spaces}${l}\n`);
        first = false;
      }
    }
  }

  /**
   * Figures out the width of the console (if attached) or a reasonable default
   * if not.
   *
   * @returns {number} The console width.
   */
  _consoleWidth() {
    if (!(this._useConsole && process.stdout.isTTY)) {
      return DEFAULT_CONSOLE_WIDTH;
    }

    return Math.max(
      MIN_CONSOLE_WIDTH,
      process.stdout.getWindowSize()[0] || DEFAULT_CONSOLE_WIDTH);
  }

  /**
   * Constructs a prefix header for the given log record. Also updates the
   * instance fields that track the observed prefix lengths.
   *
   * @param {LogRecord} logRecord The log record in question.
   * @returns {string} The prefix, including coloring and padding.
   */
  _makePrefix(logRecord) {
    const ck = this._chalk;
    let text = logRecord.prefixString;

    // Color the prefix depending on the event name / severity level.
    switch (logRecord.payload.name) {
      case 'error': { text = ck.red.bold(text);    break; }
      case 'warn':  { text = ck.yellow.bold(text); break; }
      default:      { text = ck.dim.bold(text);    break; }
    }

    // If there's context, color it and append it.
    if (logRecord.contextString !== null) {
      text += ` ${ck.hex('#44e').bold(logRecord.contextString)}`;
    }

    // **Note:** `stringLength()` takes into account the fact that ANSI color
    // escapes don't add to the visual-length of a string. `+1` to guarantee at
    // least one space of padding.
    const length = stringLength(text) + 1;

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
   * Creates a colorized message string from a time record.
   *
   * @param {LogRecord} logRecord Time log record.
   * @returns {string} Corresponding colorized message.
   */
  _timeString(logRecord) {
    const ck           = this._chalk;
    const [utc, local] = logRecord.timeStrings;

    return `${ck.blue.bold(utc)} / ${ck.blue.dim.bold(local)}`;
  }

  /**
   * Writes the given string to the log file, and to the console (if
   * appropriate).
   *
   * @param {string} text String to write.
   */
  _write(text) {
    if (this._useConsole) {
      if (this._stripConsoleColor) {
        // Actual console doesn't support color, so strip it.
        process.stdout.write(stripAnsi(text));
      } else {
        process.stdout.write(text);
      }
    }

    if (this._path !== null) {
      fs.appendFileSync(this._path, text);
    }
  }
}
