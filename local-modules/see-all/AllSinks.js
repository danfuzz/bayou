// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { Errors, Singleton } from 'util-common';

import LogRecord from './LogRecord';

/**
 * {Int} Maximum amount of time, in msec, between successive logs that inidicate
 * an active spate of logging, and thus _should not_ be a cause for emitting a
 * `sink.time()` call.
 */
const LULL_MSEC = 60 * 1000; // One minute.

/**
 * {Int} Maximum amount of time, in msec, between `sink.time()` calls, even when
 * there is logging activity which is frequent enough not to run afoul of
 * `LULL_MSEC`. That is, if logging is chatty, there will still be calls to
 * `sink.time()` at about this frequency.
 */
const MAX_GAP_MSEC = 5 * 60 * 1000; // Five minutes.

/**
 * {Int} Maximum number of log lines that should be written before a
 * `sink.time()` call. That is, super-duper chatty logging will still get
 * punctuated by regular time logs.
 */
const MAX_LOGS_PER_TIME = 100;

/**
 * Set of all logging sinks (final logging destinations). This is a
 * module-internal class whose functionality is effectively exposed by the
 * `SeeAll` and `Logger` classes.
 */
export default class AllSinks extends Singleton {
  /**
   * Constructs the instance.
   */
  constructor() {
    super();

    /** {array<object>} The actual sinks to use. */
    this._sinks = [];

    /** {Int} The timestamp of the most recently logged line. */
    this._lastNow = 0;

    /** {Int} Count of lines logged since the most recent time log. */
    this._linesSinceTime = 0;

    Object.seal(this);
  }

  /**
   * Adds a logging sink to the system.
   *
   * @param {object} sink The logging sink to use.
   */
  add(sink) {
    this._sinks.push(sink);
  }

  /**
   * Constructs a {@link LogRecord} based on the given arguments and the current
   * time, and calls `sinkLog(logRecord)` on each of the registered sinks.
   *
   * @param {string} level Severity level.
   * @param {string} tag Name of the component associated with the message.
   * @param {...*} message Message to log.
   */
  log(level, tag, ...message) {
    if (this._sinks.length === 0) {
      // Bad news! No sinks have yet been added. Typically indicates trouble
      // during init. Instead of silently succeeding (or at best succeeding
      // while logging to `console`), we die with an error here so that it is
      // reasonably blatant that something needs to be fixed during application
      // bootstrap.
      const details = inspect(level, tag, ...message);
      throw Errors.bad_use(`Overly early log call: ${details}`);
    }

    const logRecord =
      new LogRecord(this._nowMsec(), LogRecord.makeStack(), level, tag, ...message);

    for (const s of this._sinks) {
      s.sinkLog(logRecord);
    }
  }

  /**
   * Calls `sink.time()` on all of the logging sinks.
   *
   * @param {Int} timeMsec The time to pass to the sinks.
   */
  _callTime(timeMsec) {
    // Note: We don't check to see if there are any sinks here. That check
    // gets done more productively in `log()`, above.

    const logRecord = LogRecord.forTime(timeMsec);

    for (const s of this._sinks) {
      s.sinkLog(logRecord);
    }

    this._linesSinceTime = 0;
  }

  /**
   * Gets a msec timestamp representing the current time, suitable for passing
   * as such to `sink.sinkLog()`. This will also generate `sink.time()` calls at
   * appropriate junctures to "punctuate" gaps.
   *
   * @returns {Int} The timestamp.
   */
  _nowMsec() {
    const lastNow = this._lastNow;
    const now     = Date.now();

    if (this._linesSinceTime >= MAX_LOGS_PER_TIME) {
      // Logging is coming fast and furious right now.
      this._callTime(now);
    } else if (now >= (lastNow + LULL_MSEC)) {
      // There was a lull between the last log and this one.
      this._callTime(now);
    } else {
      // Figure out where to "punctuate" longer spates of logging, such that the
      // timestamps come out even multiples of the maximum gap.
      const nextGapMarker = lastNow - (lastNow % MAX_GAP_MSEC) + MAX_GAP_MSEC;

      if (now >= nextGapMarker) {
        this._callTime(nextGapMarker);
      }
    }

    this._linesSinceTime++;
    this._lastNow = now;

    return now;
  }
}
