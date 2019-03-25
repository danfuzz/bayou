// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';

import { BaseSink, SeeAll } from '@bayou/see-all';
import { TBoolean, TString } from '@bayou/typecheck';

import Redactor from './Redactor';

/**
 * Implementation of the `@bayou/see-all` logging sink protocol which stores
 * logged items to a file.
 */
export default class FileSink extends BaseSink {
  /**
   * Constructs an instance. This will cause the instance to be registered with
   * the main `@bayou/see-all` module.
   *
   * @param {string} path Path of the file to log to.
   * @param {boolean} useConsole If `true`, also write logs to the console.
   *   (Technically, write to `process.stdout`.)
   */
  constructor(path, useConsole) {
    super();

    /** {string} Path of the file to log to. */
    this._path = TString.nonEmpty(path);

    /**
     * {boolean} Whether or not to write logs to the console (`process.stdout`,
     * really).
     */
    this._useConsole = TBoolean.check(useConsole);

    SeeAll.theOne.add(this);
  }

  /**
   * Writes a log record to the file.
   *
   * @param {LogRecord} logRecord The record to write.
   */
  _impl_sinkLog(logRecord) {
    logRecord = Redactor.redact(logRecord);

    const { tag: { main, context }, stack, timeMsec } = logRecord;
    const tag        = [main, ...context];
    const metricName = logRecord.metricName;
    const details    = { timeMsec, stack, tag };

    if (metricName !== null) {
      // Metrics are pulled into the `details` directly with the same key as the
      // metric name.
      details[metricName] = FileSink._metricArgsFrom(logRecord);
    } else if (logRecord.isTime()) {
      // No need to log timestamp records. Those are only really useful for
      // human-oriented logging, because every log record builds in a timestamp
      // which gets included in its JSON-encoded form.
      return;
    } else if (logRecord.isMessage()) {
      details.level   = logRecord.payload.name;
      details.message = logRecord.messageString;
    } else {
      // Regular event.
      details.message = logRecord.messageString;
    }

    this._writeJson(details);
  }

  /**
   * Appends the JSON-encoded form of a given value to the log, along with a
   * newline.
   *
   * @param {*} value Value to log.
   */
  _writeJson(value) {
    const string = `${JSON.stringify(value)}\n`;

    if (this._useConsole) {
      process.stdout.write(string);
    }

    fs.appendFileSync(this._path, string);
  }

  /**
   * Gets the arguments to represent in the logs for the given metric-bearing
   * log record. Specifically, the "raw" arguments are always an array, but
   * (a) for ease of human consumption, the single argument of a single-argument
   * array is represented in the result directly, and (b) for minimal downstream
   * confusion (human and code), a no-argument array gets converted to the
   * boolean value `true`.
   *
   * @param {LogRecord} logRecord The record in question.
   * @returns {*} The corresponding arguments to represent in the log.
   */
  static _metricArgsFrom(logRecord) {
    const args = logRecord.payload.args;

    switch (args.length) {
      case 0:  { return true;    }
      case 1:  { return args[0]; }
      default: { return args;    }
    }
  }
}
