// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { TInt, TString } from '@bayou/typecheck';
import { CommonBase, DataUtil, ErrorUtil, Errors, Functor } from '@bayou/util-common';

import LogTag from './LogTag';

/** {array<string>} Array of valid severity levels for message instances. */
const MESSAGE_LEVELS_ARRAY =
  Object.freeze(['debug', 'error', 'warn', 'info', 'detail']);

/**
 * {Set<string>} Set of severity levels for message instances where having a
 * stack trace in the human-oriented output is most desirable.
 */
const WANT_STACK_LEVELS = new Set(['debug', 'error', 'warn']);

/** {Set<string>} Set of valid severity levels for message instances. */
const MESSAGE_EVENT_NAMES = new Set(MESSAGE_LEVELS_ARRAY);

/** {string} Event name used for timestamp events. */
const TIME_EVENT_NAME = LogTag.TIME.main;

/**
 * {Set<string>} Set of reserved event names, which are invalid to use for
 * generic events as created by {@link #forEvent}.
 */
const RESERVED_EVENT_NAMES = new Set([...MESSAGE_LEVELS_ARRAY, TIME_EVENT_NAME]);

/**
 * Entry for an item to log. Every instance has a timestamp, a component tag,
 * and an optional stack trace. Beyond that, there are three categories of
 * instance, each which defines a different set of additional data:
 *
 * * Structured events &mdash; These are arbitrary values structured like
 *   function / method calls, that is, with a name and an arbitrary list of
 *   data arguments. The arguments must be pure data. By convention, any given
 *   event name should be used in a consistent manner, such that it is possible
 *   to interpret each usage in the same way.
 *
 * * Ad-hoc human-oriented messages &mdash; These are messages which got emitted
 *   via one of the message-oriented logging methods, for example
 *   {@link Logger#info} and {@link Logger#error}. In addition to the basic
 *   fields, these come with a severity level which corresponds to the logging
 *   method (e.g., `info` or `error`) along with arbitrary additional arguments
 *   which are used to form the message. These arguments can truly be any value
 *   at all. In a client (browser) environment, the system makes an effort to
 *   pass them through to the console with full fidelity (e.g. such that objects
 *   can be unfurled and inspected). On the server side, the system converts
 *   these to pure data (notably, stringifying anything that isn't simple data)
 *   before writing them to storage.
 *
 * * Timestamps &mdash; These are timestamp-only instances, which are
 *   automatically generated by the system as an aid to readability when logs
 *   are printed to the console (or logged to a file) in a form for direct
 *   human consumption. In addition to the basic fields, these contain two
 *   string representations of the timestamp, one as a UTC time, and one in the
 *   local timezone.
 *
 * For the ad-hoc messages, the following are the possible "severity levels:"
 *
 * * `debug` -- Severity level indicating temporary stuff for debugging. Code
 *   that uses this level should not in general get checked into the repo.
 *
 * * `error` -- Severity level indicating a dire error. Logs at this level
 *   should indicate something that went horribly awry, as opposed to just being
 *   a more innocuous errory thing that normally happens from time to time, such
 *   as, for example, a network connection that dropped unexpectedly.
 *
 * * `warn` -- Severity level indicating a warning. Trouble, but not dire. Logs
 *   at this level should indicate something that is out-of-the-ordinary but not
 *   unrecoverably so.
 *
 * * `info` -- Severity level indicating general info. No problem, but maybe you
 *   care. Logs at this level should come at a reasonably stately pace (maybe a
 *   couple times a minute or so) and give a general sense of the healthy
 *   operation of the system.
 *
 * * `detail` -- Severity level indicating detailed operation. These might be
 *   used multiple times per second, to provide a nuanced view into the
 *   operation of a component. These logs are squelched by default, as they
 *   typically distract from the big picture of the system. They are meant to be
 *   turned on selectively during development and debugging.
 */
export default class LogRecord extends CommonBase {
  /** {array<string>} Array of all valid levels. */
  static get MESSAGE_LEVELS() {
    return MESSAGE_LEVELS_ARRAY;
  }

  /**
   * Validates a structured event name. Throws an error if invalid.
   *
   * @param {string} name Event name.
   * @returns {string} `name`, if it is indeed valid.
   */
  static checkEventName(name) {
    if (RESERVED_EVENT_NAMES.has(name)) {
      throw Errors.badValue(name, 'structured event name');
    }

    return name;
  }

  /**
   * Validates a logging severity level value as used for _message_
   * (human-oriented message) log records. Throws an error if invalid.
   *
   * @param {string} level Severity level. Must be one of the severity level
   *   constants defined by this class.
   * @returns {string} `level`, if it is indeed valid.
   */
  static checkMessageLevel(level) {
    if (!MESSAGE_EVENT_NAMES.has(level)) {
      throw Errors.badValue(level, 'message logging severity level');
    }

    return level;
  }

  /**
   * Constructs an instance of this class for representing a named structured
   * event.
   *
   * @param {Int} timeMsec Timestamp of the message.
   * @param {string|null} stack Stack trace representing the call site which
   *   caused this instance to be created. or `null` if that information is not
   *   available.
   * @param {LogTag} tag Tag (component name and optional context) associated
   *   with the message.
   * @param {Functor} payload Event payload. `payload.name` must _not_
   *   correspond to the event name used for any of the ad-hoc message severity
   *   levels or for timestamp logs. `payload.args` must be deep-frozen data.
   * @returns {LogRecord} Appropriately-constructed instance of this class.
   */
  static forEvent(timeMsec, stack, tag, payload) {
    LogRecord.checkEventName(payload.name);

    if (!DataUtil.isDeepFrozen(payload.args)) {
      throw Errors.badValue(payload, 'deep-frozen data');
    }

    return new LogRecord(timeMsec, stack, tag, payload);
  }

  /**
   * Constructs an instance of this class for representing an ad-hoc
   * human-oriented message.
   *
   * @param {Int} timeMsec Timestamp of the message.
   * @param {string|null} stack Stack trace representing the call site which
   *   caused this instance to be created. or `null` if that information is not
   *   available.
   * @param {LogTag} tag Tag (component name and optional context) associated
   *   with the message.
   * @param {string} level Severity level.
   * @param {...*} message Message to log.
   * @returns {LogRecord} Appropriately-constructed instance of this class.
   */
  static forMessage(timeMsec, stack, tag, level, ...message) {
    LogRecord.checkMessageLevel(level);
    return new LogRecord(timeMsec, stack, tag, new Functor(level, ...message));
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
    const payload     = new Functor(TIME_EVENT_NAME, utcString, localString);

    return new LogRecord(timeMsec, null, LogTag.TIME, payload);
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
      raw = LogRecord._justInspect(value);
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
   * Constructs an instance. **Note:** This constructor is meant to _only_ be
   * used within this class; external callers should construct instances via
   * one of the static constructor methods, e.g. {@link #forMessage}.
   *
   * @param {Int} timeMsec Timestamp of the message.
   * @param {string|null} stack Stack trace representing the call site which
   *   caused this instance to be created. or `null` if that information is not
   *   available.
   * @param {LogTag} tag Tag (component name and optional context) associated
   *   with the message.
   * @param {Functor} payload Main log payload. In the case of ad-hoc
   *   human-oriented messages, the functor name is the severity level.
   */
  constructor(timeMsec, stack, tag, payload) {
    super();

    /** {Int} Timestamp of the message. */
    this._timeMsec = TInt.nonNegative(timeMsec);

    /**
     * {string|null} stack Stack trace representing the call site which caused
     * this instance to be created. or `null` if that information is not
     * available.
     */
    this._stack = TString.orNull(stack);

    /**
     * {LogTag} Tag (component name and optional context) associated with the
     * message.
     */
    this._tag = LogTag.check(tag);

    /**
     * {Functor} Main log payload. In the case of ad-hoc human-oriented
     * messages, the functor name is the severity level.
     */
    this._payload = Functor.check(payload);

    Object.freeze(this);
  }

  /**
   * {string|null} The standard-form tag context string for this instance, or
   * `null` if there is no context.
   */
  get contextString() {
    const context = this.tag.context;

    return (context.length === 0)
      ? null
      : `[${context.join(' ')}]`;
  }

  /**
   * {Functor} Main log payload. In the case of ad-hoc human-oriented
   * messages, the functor name is the severity level.
   */
  get payload() {
    return this._payload;
  }

  /**
   * {string} Unified message string, composed from all of the individual
   * arguments. The form varies based on the sort of record (ad-hoc message vs.
   * structured event vs. timestamp).
   *
   * * For ad-hoc messages, the result is produced by calling
   *   {@link #inspectValue} on each of the message arguments, concatenating all
   *   of them together, separating single-line values from each other with a
   *   single space, and newline-separating multi-line values (so that each ends
   *   up on its own line).
   *
   *   As a special-ish case, the {@link #stack} of the instance is included in
   *   the result if it is non-`null`, the instance doesn't have an error as one
   *   of its arguments, _and_ the instance is an ad-hoc message at `debug`,
   *   `warn`, or `error` level (where stack traces are generally expected).
   *
   *   Single-line results have no newlines (including at the end). Multi-line
   *   results always end with a newline.
   *
   * * For structured events, the result is from a call to {@link util#inspect}
   *   on the entire {@link #payload}.
   *
   * * For timestamp logs, the result is the two time strings, separated by a
   *   slash, with no newline.
   */
  get messageString() {
    if (this.isTime()) {
      const [utc, local] = this.timeStrings;
      return `${utc} / ${local}`;
    } else if (this.isEvent()) {
      return LogRecord._justInspect(this.payload);
    }

    // The rest of this is for the ad-hoc message case (which is considerably
    // more involved).

    const result      = [];
    let   atLineStart = true;
    let   anyNewlines = false;

    for (const a of this.payload.args) {
      const s = LogRecord.inspectValue(a);
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

    // Append the stack if available and appropriate. See the header doc for
    // more info.
    if (   this.isMessage()
        && (this.stack !== null)
        && WANT_STACK_LEVELS.has(this.payload.name)
        && !this.hasError()) {
      if (!anyNewlines) {
        // Appending the stack will make an otherwise single-line result into a
        // multiline one, and the pending result doesn't yet have any newlines.
        result.push('\n');
      }

      for (const line of this.stack.split('\n')) {
        result.push(`  ${line}\n`);
      }
    }

    return result.join('');
  }

  /**
   * {string} The standard-form prefix string for the level and tag of this
   * instance.
   */
  get prefixString() {
    const { payload: { name }, tag: { main } } = this;
    const levelStr = ((name === 'info') || !this.isMessage())
      ? ''
      : ` ${name[0].toUpperCase()}`;

    return `[${main}${levelStr}]`;
  }

  /**
   * {string|null} Stack trace representing the call site which caused this
   * instance to be created. or `null` if that information is not available.
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
   * {array<string>} Two-element array of the time strings embedded in timestamp
   * instances, namely the UTC time string and the local-timezone time string.
   * It is only valid to access this property on timestamp instances; it is an
   * error to use it with any other instance.
   */
  get timeStrings() {
    if (!this.isTime()) {
      throw Errors.badUse('Requires a timestamp instance.');
    }

    return this.payload.args;
  }

  /**
   * Gets reconstruction arguments for this instance. In this case, this method
   * is implemented, in particular, so that calling `inspect()` on instances of
   * this class produces sensible output.
   *
   * @returns {array<*>} Reconstruction arguments.
   */
  deconstruct() {
    const { timeMsec, stack, tag, payload } = this;
    return [timeMsec, stack, tag, payload];
  }

  /**
   * Indicates whether any of the `message` arguments of this instance is an
   * `Error`.
   *
   * @returns {boolean} `true` iff this instance's `message` contains at least
   *   one `Error`.
   */
  hasError() {
    for (const a of this.payload.args) {
      if (a instanceof Error) {
        return true;
      }
    }

    return false;
  }

  /**
   * Indicates whether this instance represents a structured event, as for
   * example constructed by {@link #forEvent}.
   *
   * @returns {boolean} `true` iff this is a structured event instance.
   */
  isEvent() {
    return !RESERVED_EVENT_NAMES.has(this.payload.name);
  }

  /**
   * Indicates whether this instance represents an ad-hoc message, as for
   * example constructed by {@link #forMessage}.
   *
   * @returns {boolean} `true` iff this is an ad-hoc message instance.
   */
  isMessage() {
    return MESSAGE_EVENT_NAMES.has(this.payload.name);
  }

  /**
   * Indicates whether this instance represents a timestamp, as for example
   * constructed by {@link #forTime}.
   *
   * @returns {boolean} `true` iff this is a timestamp instance.
   */
  isTime() {
    return this.payload.name === TIME_EVENT_NAME;
  }

  /**
   * Constructs an instance just like this one, except with `payload` replaced
   * with the indicated contents. It is only valid to call this method on
   * instances for which {@link #isEvent} returns `true`; other cases will
   * throw an error.
   *
   * @param {payload} payload New payload.
   * @returns {LogRecord} An appropriately-constructed instance.
   */
  withEvent(payload) {
    const { timeMsec, stack, tag } = this;

    if (!this.isEvent()) {
      throw Errors.badUse('Requires an event instance.');
    } else if (!DataUtil.isDeepFrozen(payload.args)) {
      throw Errors.badValue(payload, 'deep-frozen data');
    }

    return new LogRecord(timeMsec, stack, tag, payload);
  }

  /**
   * Constructs an instance just like this one, except with `message` replaced
   * with the indicated contents. It is only valid to call this method on
   * instances for which {@link #isMessage} returns `true`; other cases will
   * throw an error.
   *
   * @param {...*} message New message.
   * @returns {LogRecord} An appropriately-constructed instance.
   */
  withMessage(...message) {
    const { timeMsec, stack, tag, payload } = this;

    if (!this.isMessage()) {
      throw Errors.badUse('Requires a message instance.');
    }

    const newPayload = new Functor(payload.name, ...message);

    return new LogRecord(timeMsec, stack, tag, newPayload);
  }

  /**
   * Constructs an instance just like this one, except with `tag` replaced as
   * indicated contents.
   *
   * @param {LogTag} tag New tag.
   * @returns {LogRecord} An appropriately-constructed instance.
   */
  withTag(tag) {
    const { timeMsec, stack, payload } = this;

    return new LogRecord(timeMsec, stack, tag, payload);
  }

  /**
   * Calls `util.inspect()` on the given value, with standardized options.
   *
   * @param {*} value Value to inspect.
   * @returns {string} The inspected form.
   */
  static _justInspect(value) {
    return inspect(value, { depth: 20, maxArrayLength: 200, breakLength: 120 });
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
