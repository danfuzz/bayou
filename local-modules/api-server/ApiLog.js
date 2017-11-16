// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';

import { Logger } from 'see-all';
import { TString } from 'typecheck';
import { CommonBase } from 'util-common';

/** {Logger} Console logger. */
const log = new Logger('api');

/**
 * Singleton class that handles the logging of API calls.
 */
export default class ApiLog extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {string} logFile Path of API log file.
   */
  constructor(logFile) {
    super();

    /** {string} Path of API log file. */
    this._path = TString.nonEmpty(logFile);

    Object.freeze(this);
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
   * @param {Message|null} msg Incoming message, or `null` if there wasn't a
   *   valid message as part of this call.
   * @param {Response} response Response to the message.
   */
  fullCall(connectionId, startTime, msg, response) {
    log.detail('Response:', response);

    if (response.error) {
      // TODO: Ultimately _some_ errors coming back from API calls shouldn't
      // be considered console-log-worthy server errors. We will need to
      // differentiate them at some point.
      log.error(`[${connectionId}] Error.`, response.originalError);
    }

    // Details to log. **TODO:** This will ultimately need to redact some
    // information from `msg` and `response`.
    const details = {
      startTime,
      endTime:      Date.now(),
      connectionId,
      ok:           !response.error,
      msg:          msg ? msg.toLog() : null
    };

    if (details.ok) {
      details.result = response.result;
    } else {
      // `response.originalError` per se isn't a JSON-friendly value, whereas
      // the `originalTrace` is a plain array of strings.
      details.error = response.originalTrace;
    }

    this._writeJson(details);
  }

  /**
   * Logs an incoming message. This should be called just after the message was
   * decoded off of an incoming connection.
   *
   * @param {string} connectionId Identifier for the connection.
   * @param {Int} startTime Timestamp for the start of the call.
   * @param {object} msg Incoming message.
   */
  incomingMessage(connectionId, startTime, msg) {
    // TODO: This will ultimately need to redact some information.
    log.detail(`[${connectionId}] Message at ${startTime}:`, msg.toLog());
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
