// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Message, Response } from '@bayou/api-common';
import { BaseLogger, RedactUtil } from '@bayou/see-all';
import { TBoolean } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

import Target from './Target';

/** {Int} Maximum depth to produce when redacting values. */
const MAX_REDACTION_DEPTH = 4;

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
      this._log.event.orphanMessage(this._redactInitialDetails(details));
    }

    if (response.error) {
      // **TODO:** Ultimately _some_ errors coming back from API calls shouldn't
      // be considered console-log-worthy server errors. We will need to
      // differentiate them at some point.
      this._log.error('Error from API call:', response.originalError);
    }

    this._finishDetails(details, response);
    this._logCompletedCall(details, target);
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
    this._log.event.apiReceived(this._redactInitialDetails(details));
  }

  /**
   * Logs a response that doesn't have a corresponding incoming message.
   *
   * @param {Response} response Response which was sent.
   */
  nonMessageResponse(response) {
    const details = this._initialDetails(null);

    this._finishDetails(details, response);
    this._logCompletedCall(details, null);
  }

  /**
   * Modifies the given details object to represent a completed call.
   *
   * @param {object} details Ad-hoc details object to modify.
   * @param {Response} response Response which is being sent to the caller.
   */
  _finishDetails(details, response) {
    details.endTime      = this._now();
    details.durationMsec = details.endTime - details.startTime;

    if (response.error) {
      details.ok     = false;
      details.error  = response.originalError;
    } else {
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

    return {
      msg:       msg ? msg.logInfo : null,
      startTime: now
    };
  }

  /**
   * Performs end-of-call logging.
   *
   * @param {object} details Ad-hoc object with call details.
   * @param {Target|null} target The target that handled the message, if any.
   */
  _logCompletedCall(details, target) {
    const { durationMsec, msg, ok } = details;
    const method = msg ? msg.payload.name : '<unknown>';

    this._log.event.apiReturned(this._redactFullDetails(details, target));

    // For ease of downstream handling (especially graphing), log a metric of
    // just the method name, success flag, and elapsed time.
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

  /**
   * Gets the value-redacted form of the given ad-hoc call details object, which
   * should be the _complete_ post-call form, if redaction is required by the
   * configuration of this instance. If not, this returns the `details` as-is.
   *
   * **Note:** This only possibly affects the `msg` binding of the details;
   * everything else will always get passed through as-is.
   *
   * @param {object} details Ad-hoc object will call details.
   * @param {Target|null} target_unused The target that handled the message, if
   *   any.
   * @returns {object} Possibly value-redacted form of `details`, or `details`
   *   itself if this instance is not performing redaction.
   */
  _redactFullDetails(details, target_unused) {
    if (!this._shouldRedact) {
      return details;
    }

    // **TODO:** Use `target` to drive selective redaction of the message
    // payload.

    const { msg: origMsg, result: origResult } = details;
    const replacements = {};

    if (origResult) {
      replacements.result =
        RedactUtil.wrapRedacted(RedactUtil.redactValues(origResult, MAX_REDACTION_DEPTH));
    }

    if (origMsg) {
      const payload =
        RedactUtil.wrapRedacted(RedactUtil.redactValues(origMsg.payload, MAX_REDACTION_DEPTH));
      replacements.msg = Object.assign({}, origMsg, { payload });
    }

    return Object.assign({}, details, replacements);
  }

  /**
   * Gets the value-redacted form of the given ad-hoc call details object as
   * produced by {@link #_initialDetails}, if redaction is required by the
   * configuration of this instance. If not, this returns the `details` as-is.
   *
   * **Note:** This only possibly affects the `msg` binding of the details;
   * everything else will always get passed through as-is.
   *
   * @param {object} details Ad-hoc object will call details.
   * @returns {object} Possibly value-redacted form of `details`, or `details`
   *   itself if this instance is not performing redaction.
   */
  _redactInitialDetails(details) {
    const origMsg = details.msg;

    if ((origMsg === null) || !this._shouldRedact) {
      return details;
    }

    // When redacting the incoming details, we are not selective (that is, we
    // don't use metadata to drive redaction) because at this point in the API
    // handling process we don't have enough information to do so. That is, this
    // call is made before the target of the message is known as an actual
    // object, and it is only after the target is so known that we can use it to
    // do selective redaction.

    const payload = RedactUtil.wrapRedacted(RedactUtil.redactValues(origMsg.payload, MAX_REDACTION_DEPTH));
    const msg     = Object.assign({}, origMsg, { payload });

    return Object.assign({}, details, { msg });
  }
}
