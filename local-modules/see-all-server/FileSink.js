// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';

import { BaseSink, SeeAll } from 'see-all';
import { TString } from 'typecheck';

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
   */
  constructor(path) {
    super();

    /** {string} Path of the file to log to. */
    this._path = TString.nonEmpty(path);

    SeeAll.theOne.add(this);
  }

  /**
   * Writes a log record to the file.
   *
   * @param {LogRecord} logRecord The record to write.
   */
  _impl_sinkLog(logRecord) {
    const { level, tag: { main, context }, timeMsec } = logRecord;
    const tag = [main, ...context];

    this._writeJson({ timeMsec, level, tag, message: logRecord.messageString });
  }

  /**
   * Appends the JSON-encoded form of a given value to the log, along with a
   * newline.
   *
   * @param {*} value Value to log.
   */
  _writeJson(value) {
    const string = `${JSON.stringify(value)}\n`;
    fs.appendFileSync(this._path, string);
  }
}
