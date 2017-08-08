// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import path from 'path';

import { Logger } from 'see-all';
import { Dirs } from 'server-env';
import { Singleton } from 'util-common';

/**
 * Singleton class that handles the logging of API calls.
 */
export default class ApiLog extends Singleton {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    /** {Logger} Console logger. */
    this._console = new Logger('api');

    /** {string} Path of API log file. */
    this._path = path.resolve(Dirs.theOne.LOG_DIR, 'api.log');

    Object.freeze(this);
  }

  /**
   * Logs an incoming message. This should be called just after the message was
   * decoded off of an incoming connection. This method returns the timestamp
   * that should be used as the `startTime` when logging the completed API call.
   *
   * @param {string} connectionId Identifier for the connection.
   * @param {object} msg Incoming message.
   * @returns {Int} Standard msec timestamp indicating the start time of the API
   *   call being represented here.
   */
  incomingMessage(connectionId, msg) {
    // TODO: This will ultimately need to redact some information.
    this._console.detail(`[${connectionId}] Message:`, msg.toLog());

    return Date.now();
  }

  /**
   * Logs a full API call. This should be called after the message has been
   * fully handled, and the response either has been sent or is at least _ready_
   * to be sent.
   *
   * @param {string} connectionId Identifier for the connection.
   * @param {Int} startTime Standard msec timestamp indicating the start time of
   *   the API call being represented here. Should be the value returned from
   *   the earlier call to `incomingMessage()` for `msg`.
   * @param {object} msg Incoming message.
   * @param {object} response Response to the message.
   */
  fullCall(connectionId, startTime, msg, response) {
    if (response.error) {
      // TODO: Ultimately _some_ errors coming back from API calls shouldn't
      // be considered console-log-worthy server errors. We will need to
      // differentiate them at some point.
      this._console.error(`[${connectionId}] Error:`, response.error);
      if (response.errorStack) {
        const stackString = response.errorStack.join('\n  ');
        this._console.info(`Original trace:\n  ${stackString}`);
      }
    }

    this._console.detail('Response:', response);

    // TODO: This will ultimately need to redact some information from `msg` and
    // `response`.
    const details = {
      startTime,
      endTime:      Date.now(),
      connectionId,
      ok:           !response.error,
      msg:          msg.toLog()
    };

    if (details.ok) {
      details.result = response.result;
    } else {
      details.error      = response.error;
      details.errorStack = response.errorStack || [];
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
    fs.appendFileSync(this._path, string);
  }
}
