// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseLogger } from '@bayou/see-all';
import { CommonBase } from '@bayou/util-common';

/**
 * Handler of the logging of API calls.
 */
export default class ApiLog extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Logger} log Logger to use.
   */
  constructor(log) {
    super();

    /** {BaseLogger} Logger to use. */
    this._log = BaseLogger.check(log);

    /**
     * {Map<Message,object>} Map from messages that haven't yet been completely
     * processed to the initial details of those messages, each in the form of
     * an ad-hoc plain object.
     */
    this._pending = new Map();

    Object.freeze(this);
  }

  /**
   * Logs a full API call. This should be called after the message has been
   * fully handled, and the response either has been sent or is at least _ready_
   * to be sent.
   *
   * @param {Message} msg Incoming message.
   * @param {Response} response Response to the message.
   */
  fullCall(msg, response) {
    let details = this._pending.get(msg);

    if (details) {
      this._pending.delete(msg);
    } else {
      this._log.warning('Orphan message:', msg);
      details = this._initialDetails(msg);
    }

    if (response.error) {
      // TODO: Ultimately _some_ errors coming back from API calls shouldn't
      // be considered console-log-worthy server errors. We will need to
      // differentiate them at some point.
      this._log.error('Error from API call:', response.originalError);
    }

    this._finishDetails(details, response);
    this._logCompletedCall(details);
  }

  /**
   * Logs an incoming message. This should be called just after the message was
   * decoded off of an incoming connection.
   *
   * @param {Message} msg Incoming message.
   */
  incomingMessage(msg) {
    const details = this._initialDetails(msg);

    this._pending.set(msg, details);
    this._log.event.apiReceived(details);
  }

  /**
   * Logs a response that doesn't have a corresponding incoming message.
   *
   * @param {Response} response Response which was sent.
   */
  nonMessageResponse(response) {
    const details = this._initialDetails(null);

    this._finishDetails(details, response);
    this._logCompletedCall(details);
  }

  /**
   * Modifies the given details object to represent a completed call.
   *
   * @param {object} details Ad-hoc details object to modify.
   * @param {Response} response Response which is being sent to the caller.
   */
  _finishDetails(details, response) {
    details.endTime = this._now();

    if (response.error) {
      details.ok     = false;
      details.error  = response.originalError;
    } else {
      // **TODO:** This will ultimately need to redact some information in
      // `response.result`.
      details.ok     = true;
      details.result = response.result;
    }
  }

  /**
   * Makes the initial details object to represent an incoming call.
   *
   * @param {Message|null} msg The incoming message, if any.
   * @returns {object} Ad-hoc details object.
   */
  _initialDetails(msg) {
    const now = this._now();

    // **TODO:** This will ultimately need to redact some information in `msg`
    // beyond what `msg.logInfo` might have done.

    return {
      msg:       msg ? msg.logInfo : null,
      startTime: now,
      ok:        false
    };
  }

  /**
   * Performs end-of-call logging.
   *
   * @param {object} details Ad-hoc object with call details.
   */
  _logCompletedCall(details) {
    const msg          = details.msg;
    const method       = msg ? msg.payload.name : '<unknown>';
    const durationMsec = details.endTime - details.startTime;
    const ok           = details.ok;

    details.durationMsec = durationMsec;

    this._log.event.apiReturned(details);

    // For easy downstream, log a metric of just the method name, success flag,
    // and elapsed time.
    this._log.metric.apiCall({ ok, durationMsec, method });
  }

  /**
   * Gets the current time, in the usual Unix Epoch msec form.
   *
   * **Note:** This method exists so as to make this class a little easier to
   * test.
   *
   * @returns {Int} The current time in msec since the Unix Epoch.
   */
  _now() {
    return Date.now();
  }
}
