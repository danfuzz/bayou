// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';

import { BaseSink, SeeAll } from 'see-all';
import { TBoolean, TString } from '@bayou/typecheck';

/**
 * Implementation of the `see-all` logging sink protocol which stores logged
 * items to a file.
 */
export default class FileSink extends BaseSink {
  /**
   * Constructs an instance. This will cause the instance to be registered with
   * the main `see-all` module.
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
    const { tag: { main, context }, stack, timeMsec } = logRecord;
    const tag     = [main, ...context];
    const details = { timeMsec, stack, tag, message: logRecord.messageString };

    if (logRecord.isTime()) {
      // No need to log timestamp records. Those are only really useful for
      // human-oriented logging, because every log record builds in a timestamp
      // which gets included in its JSON-encoded form.
      return;
    } else if (logRecord.isMessage()) {
      details.level = logRecord.payload.name;
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
}
