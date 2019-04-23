// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Message, Response } from '@bayou/api-common';
import { BaseLogger } from '@bayou/see-all';
import { TBoolean } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

import Target from './Target';

/**
 * Handler of the logging of API calls.
 */
export default class ApiLog extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Logger} log Logger to use.
   * @param {boolean} shouldRedact Whether the logs should be redacted,
   *   generally speaking. Even when `false`, this will typically end up doing
   *   _some_ redaction (out of an abundance of caution).
   */
  constructor(log, shouldRedact) {
    super();

    /** {BaseLogger} Logger to use. */
    this._log = BaseLogger.check(log);

    /** {boolean} Whether the logs should be redacted, generally speaking. */
    this._shouldRedact = TBoolean.check(shouldRedact);

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
   * @param {Target|null} target The target that produced the response, if any.
   */
  fullCall(msg, response, target) {
    Message.check(msg);
    Response.check(response);
    if (target !== null) {
      Target.check(target);
    }

    let details = this._pending.get(msg);

    if (details) {
      this._pending.delete(msg);
    } else {
      // This is indicative of a bug in this module. The user of `ApiLog` should
      // have called `incomingMessage(msg)` but apparently didn't.
      details = this._initialDetails(msg);
      this._log.event.orphanMessage(this._logInfoInitial(details));
    }

    if (response.error) {
      // **TODO:** Ultimately _some_ errors coming back from API calls shouldn't
      // be considered console-log-worthy server errors. We will need to
      // differentiate them at some point.
      this._log.error('Error from API call:', response.originalError);
    }

    this._logCompletedCall(details, response, target);
  }

  /**
   * Logs an incoming message. This should be called just after the message was
   * decoded off of an incoming connection and its target object is known (or is
   * known to be invalid).
   *
   * @param {Message} msg Incoming message.
   * @param {Target|null} target The target that is handling the message, if
   *   any.
   */
  incomingMessage(msg, target) {
    Message.check(msg);
    if (target !== null) {
      Target.check(target);
    }

    const details = this._initialDetails(msg, target);

    this._pending.set(msg, details);
    this._log.event.apiReceived(this._logInfoInitial(details));
  }

  /**
   * Logs a response that doesn't have a corresponding incoming message.
   *
   * @param {Response} response Response which was sent.
   */
  nonMessageResponse(response) {
    const details = this._initialDetails(null);

    this._logCompletedCall(details, response, null);
  }

  /**
   * Makes the initial details object to represent an incoming call.
   *
   * @param {Message|null} msg The incoming message, if any.
   * @param {Target|null} target The target that is handling the message, if
   *   any.
   * @returns {object} Ad-hoc details object.
   */
  _initialDetails(msg, target) {
    const startTime = this._now();

    msg = msg ? msg.logInfo : null;

    return { msg, startTime, target };
  }

  /**
   * Performs end-of-call logging.
   *
   * @param {object} details Ad-hoc object with call details. This object is
   *   modified by this method.
   * @param {Response} response Response which is being sent to the caller.
   * @param {Target|null} target The target that handled the message, if any.
   */
  _logCompletedCall(details, response, target) {
    const msg          = details.msg;
    const method       = msg ? msg.payload.name : '<unknown>';
    const ok           = response.error ? true : false;
    const endTime      = this._now();
    const durationMsec = endTime - details.startTime;

    details.ok           = ok;
    details.endTime      = endTime;
    details.durationMsec = durationMsec;

    if (ok) {
      details.result = response.result;
    } else {
      details.error  = response.originalError;
    }

    this._log.event.apiReturned(this._logInfoFull(details, target));

    // For ease of downstream handling (especially graphing), log a metric of
    // just the method name, success flag, and elapsed time.
    this._log.metric.apiCall({ ok, durationMsec, method });
  }

  /**
   * Helper for the two main logging-oriented details processing methods, which
   * gets a clone of the given call details object and does the common
   * processing on it for both cases.
   *
   * @param {object} details Ad-hoc object with call details.
   * @returns {object} Cloned and processed version of `details`.
   */
  _logInfoCommon(details) {
    details = Object.assign({}, details);

    const { msg, target } = details;

    if (target !== null) {
      // Replace a non-null target with its class name.
      details.target = `class ${target.className}`;
    }

    if (msg !== null) {
      const payload    = msg.payload;
      const newPayload = (target === null)
        ? Target.logInfoFromPayloadForNullTarget(payload, this._shouldRedact)
        : target.logInfoFromPayload(payload, this._shouldRedact);

      if (payload !== newPayload) {
        details.msg = Object.assign({}, details.msg, { payload });
      }
    }

    return details;
  }

  /**
   * Returns a logging-appropriate form of the given ad-hoc call details object,
   * which is expected to be the complete post-call form. This always does some
   * processing on the details, and this is specifically where redaction is
   * performed when required by the configuration of this instance.
   *
   * @param {object} details Ad-hoc object with call details.
   * @returns {object} Possibly value-redacted form of `details`, or `details`
   *   itself if this instance is not performing redaction.
   */
  _logInfoFull(details) {
    const { msg, result, target } = details;

    details = this._logInfoCommon(details);

    if (result !== undefined) {
      const payload = (msg !== null) ? msg.payload : null;

      details.result = (target === null)
        ? Target.logInfoFromResultForNullTarget(result, this._shouldRedact)
        : target.logInfoFromResult(result, payload, this._shouldRedact);
    }

    return details;
  }

  /**
   * Returns a logging-appropriate form of the given ad-hoc call details object
   * as produced by {@link #_initialDetails}. This always does some processing
   * on the details, and this is specifically where redaction is performed when
   * required by the configuration of this instance.
   *
   * @param {object} details Ad-hoc object will call details, representing the
   *   state of affairs _before_ a call has been made.
   * @returns {object} Logging-appropriate form of `detail`.
   */
  _logInfoInitial(details) {
    // Just pass through to the common handler method. (In the past, this method
    // did more stuff, and it might do so again in the future. In the meantime,
    // it serves as a clear indicator of caller intent.)
    return this._logInfoCommon(details);
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
