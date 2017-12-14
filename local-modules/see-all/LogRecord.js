// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { TInt, TString } from 'typecheck';
import { CommonBase, ErrorUtil, Errors } from 'util-common';

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
   * Validates a logging severity level value. Throws an error if invalid.
   *
   * @param {string} level Severity level. Must be one of the severity level
   *   constants defined by this class.
   * @returns {string} `level`, if it is indeed valid.
   */
  static validateLevel(level) {
    if (!LEVELS_SET.has(level)) {
      throw Errors.bad_value(level, 'logging severity level');
    }

    return level;
  }

  /**
   * Constructs an instance.
   *
   * @param {Int} timeMsec Timestamp of the message.
   * @param {string} level Severity level.
   * @param {string} tag Name of the component associated with the message.
   * @param {...*} message Message to log.
   */
  constructor(timeMsec, level, tag, ...message) {
    super();

    /** {Int} Timestamp of the message. */
    this._timeMsec = TInt.nonNegative(timeMsec);

    /** {string} Severity level. */
    this._level = LogRecord.validateLevel(level);

    /** {string} Name of the component associated with the message. */
    this._tag = TString.label(tag);

    /** {array<*>} Message to log. */
    this._message = message;

    Object.freeze(this);
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
  get prefix() {
    const { level, tag } = this;
    const levelStr = (level === 'info') ? '' : ` ${level[0].toUpperCase()}`;

    return `[${tag}${levelStr}]`;
  }

  /** {string} Name of the component associated with the message. */
  get tag() {
    return this._tag;
  }

  /** {Int} Timestamp of the message. */
  get timeMsec() {
    return this._timeMsec;
  }

  /**
   * Constructs an instance just like this one, except with `message` replaced
   * with the indicated contents.
   *
   * @param {...*} message New message.
   * @returns {LogRecord} An appropriately-constructed instance.
   */
  withMessage(...message) {
    const { timeMsec, level, tag } = this;
    return new LogRecord(timeMsec, level, tag, ...message);
  }
}
