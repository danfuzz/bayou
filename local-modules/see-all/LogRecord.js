// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { TInt, TString } from 'typecheck';
import { CommonBase, ErrorUtil, Errors } from 'util-common';

import LogTag from './LogTag';

/** {array<string>} Array of valid severity levels. */
const LEVELS_ARRAY = Object.freeze(['debug', 'error', 'warn', 'info', 'detail']);

/** {Set<string>} Set of valid severity levels. */
const LEVELS_SET = new Set(LEVELS_ARRAY);

/**
 * Entry for an item to log. Contains the message to log as well as a bunch
 * of extra info.
 */
export default class LogRecord extends CommonBase {
  /** {array<string>} Array of all valid levels. */
  static get LEVELS() {
    return LEVELS_ARRAY;
  }

  /**
   * Validates a logging severity level value. Throws an error if invalid.
   *
   * @param {string} level Severity level. Must be one of the severity level
   *   constants defined by this class.
   * @returns {string} `level`, if it is indeed valid.
   */
  static checkLevel(level) {
    if (!LEVELS_SET.has(level)) {
      throw Errors.badValue(level, 'logging severity level');
    }

    return level;
  }

  /**
   * Constructs an instance of this class for representing a timestamp. The
   * result is an `info` level record tagged with `time`, and with a three-array
   * `messages` argument consisting of `[<utc>, '/', <local>]`, where `<utc>`
   * and `<local>` are UTC and local-timezone string representations.
   *
   * Though every instance comes with a time field, the logging system
   * occasionally adds explicitly timestamp lines, which are meant to aid in
   * the (human) readability of logs.
   *
   * @param {Int} timeMsec Timestamp to memorialize.
   * @returns {LogRecord} Appropriately-constructed instance of this class.
   */
  static forTime(timeMsec) {
    TInt.nonNegative(timeMsec);

    const date        = new Date(timeMsec);
    const utcString   = LogRecord._utcTimeString(date);
    const localString = LogRecord._localTimeString(date);

    return new LogRecord(timeMsec, null, 'info', LogTag.TIME,
      utcString, '/', localString);
  }

  /**
   * Returns a string form for the given value, suitable for logging. Among
   * other things:
   *
   * * It leaves strings as-is (doesn't quote them), on the assumption that
   *   they are meant to be literal text, _except_ that if a string has any
   *   newlines in it, then the result is guaranteed to end with a newline.
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
      // A little obscure, to be sure... This appends a newline to strings that
      // have a newline but don't _end_ with a newline.
      return (/\n[^]*[^\n]$/.test(value)) ? `${value}\n` : value;
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
   * Makes a stack trace for the current call site, skipping initial stack
   * frames from this module. Results of this method are suitable for passing
   * as the `stack` to this class's constructor.
   *
   * @returns {string} A stack trace.
   */
  static makeStack() {
    const trace = ErrorUtil.stackLines(new Error());

    let startAt;
    for (startAt = 0; startAt < trace.length; startAt++) {
      if (!/[/]see-all/.test(trace[startAt])) {
        break;
      }
    }

    // Only trim initial items if there's _some_ part of the trace that isn't in
    // this module.
    if (startAt < trace.length) {
      trace.splice(0, startAt);
    }

    return trace.join('\n');
  }

  /**
   * Constructs an instance.
   *
   * @param {Int} timeMsec Timestamp of the message.
   * @param {string|null} stack Stack trace representing the call site which
   *   caused this instance to be created. or `null` if that information is not
   *   available.
   * @param {string} level Severity level.
   * @param {LogTag} tag Tag (component name and optional context) associated
   *   with the message.
   * @param {...*} message Message to log.
   */
  constructor(timeMsec, stack, level, tag, ...message) {
    super();

    /** {Int} Timestamp of the message. */
    this._timeMsec = TInt.nonNegative(timeMsec);

    /**
     * {string|null} stack Stack trace representing the call site which caused
     * this instance to be created. or `null` if that information is not
     * available.
     */
    this._stack = TString.orNull(stack);

    /** {string} Severity level. */
    this._level = LogRecord.checkLevel(level);

    /**
     * {LogTag} Tag (component name and optional context) associated with the
     * message.
     */
    this._tag = LogTag.check(tag);

    /** {array<*>} Message to log. */
    this._message = message;

    Object.freeze(this);
  }

  /**
   * {string|null} The standard-form context string for this instance, or `null`
   * if there is no context.
   */
  get contextString() {
    const context = this.tag.context;

    return (context.length === 0)
      ? null
      : `[${context.join(' ')}]`;
  }


  /** {string} Severity level. */
  get level() {
    return this._level;
  }

  /** {array<*>} Message to log. */
  get message() {
    return this._message;
  }

  /**
   * {string} Unified message string, from on all of the individual message
   * arguments.
   *
   * This form runs {@link #inspectValue} on each of the message arguments,
   * concatenating all of them together, separating single-line values from each
   * other with a single space, and newline-separating multi-line values (so
   * that each ends up on its own line).
   *
   * Single-line results have no newlines (including at the end). Multi-line
   * results always end with a newline.
   */
  get messageString() {
    const result      = [];
    let   atLineStart = true;
    let   anyNewlines = false;

    for (const m of this.message) {
      const s = LogRecord.inspectValue(m);
      const hasNewline = /\n$/.test(s);

      if (!atLineStart) {
        result.push(hasNewline ? '\n' : ' ');
      }

      result.push(s);
      atLineStart = hasNewline;
      anyNewlines |= hasNewline;
    }

    // Per docs, guarantee that a multi-line result ends with a newline.
    if (anyNewlines && !atLineStart) {
      result.push('\n');
    }

    return result.join('');
  }

  /**
   * {string} The standard-form prefix string for the level and tag of this
   * instance.
   */
  get prefixString() {
    const { level, tag: { main } } = this;
    const levelStr = (level === 'info') ? '' : ` ${level[0].toUpperCase()}`;

    return `[${main}${levelStr}]`;
  }

  /**
   * {string|null} stack Stack trace representing the call site which caused
   * this instance to be created. or `null` if that information is not
   * available.
   */
  get stack() {
    return this._stack;
  }

  /** {LogTag} Tag (component name and context). */
  get tag() {
    return this._tag;
  }

  /** {Int} Timestamp of the message. */
  get timeMsec() {
    return this._timeMsec;
  }

  /**
   * Indicates whether any of the `message` arguments of this instance is an
   * `Error`.
   *
   * @returns {boolean} `true` iff this instance's `message` contains at least
   *   one `Error`.
   */
  hasError() {
    for (const m of this._message) {
      if (m instanceof Error) {
        return true;
      }
    }

    return false;
  }

  /**
   * Indicates whether this instance represents a timestamp, as for example
   * constructed by {@link #forTime}.
   *
   * @returns {boolean} `true` iff this is a timestamp instance.
   */
  isTime() {
    // The first check (the tag) is probably sufficient, but it probably can't
    // hurt to be a little pickier.
    return (this._tag === LogTag.TIME)
      && (this._message.length === 3)
      && (this._message[1] === '/');
  }

  /**
   * Constructs an instance just like this one, except with `message` replaced
   * with the indicated contents.
   *
   * @param {...*} message New message.
   * @returns {LogRecord} An appropriately-constructed instance.
   */
  withMessage(...message) {
    const { timeMsec, stack, level, tag } = this;
    return new LogRecord(timeMsec, stack, level, tag, ...message);
  }

  /**
   * Returns a string representing the given time in UTC.
   *
   * @param {Date} date The time, as a `Date` object.
   * @returns {string} The corresponding UTC time string.
   */
  static _utcTimeString(date) {
    // We start with the ISO string and tweak it to be a little more
    // human-friendly.
    const isoString = date.toISOString();
    return isoString.replace(/T/, ' ').replace(/Z/, ' UTC');
  }

  /**
   * Returns a string representing the given time in the local timezone.
   *
   * @param {Date} date The time, as a `Date` object.
   * @returns {string} The corresponding local time string.
   */
  static _localTimeString(date) {
    // We start with the local time string and cut off all everything after the
    // actual time (timezone spew).
    const localString = date.toTimeString();
    return localString.replace(/ [^0-9].*$/, ' local');
  }
}
