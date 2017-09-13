// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import { inspect } from 'util';

import { SeeAll } from 'see-all';

/**
 * Implementation of the `see-all` logging sink protocol which stores logged
 * items to a file.
 */
export default class FileSink {
  /**
   * Constructs an instance. This will cause the instance to be registered with
   * the main `see-all` module.
   *
   * @param {string} path Path of the file to log to.
   */
  constructor(path) {
    /** {string} Path of the file to log to. */
    this._path = path;

    SeeAll.theOne.add(this);
  }

  /**
   * Logs a message at the given severity level.
   *
   * @param {number} nowMsec Timestamp of the message.
   * @param {string} level Severity level.
   * @param {string} tag Name of the component associated with the message.
   * @param {...string} message Message to log.
   */
  log(nowMsec, level, tag, ...message) {
    // For any items in `message` that aren't strings, use `inspect()` to
    // stringify them.
    message = message.map((x) => {
      return (typeof x === 'string') ? x : inspect(x);
    });

    this._writeJson({ nowMsec, level, tag, message });
  }

  /**
   * Logs the indicated time value.
   *
   * @param {number} nowMsec Timestamp to log.
   * @param {string} utcString String representation of the time, as UTC.
   * @param {string} localString String representation of the time, in the local
   *   timezone.
   */
  time(nowMsec, utcString, localString) {
    this.log(nowMsec, 'info', 'time', utcString, localString);
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
