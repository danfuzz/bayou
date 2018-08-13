// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Auth } from '@bayou/config-server';
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
      details = { msg, startTime: '<unknown>' };
    }

    if (response.error) {
      // TODO: Ultimately _some_ errors coming back from API calls shouldn't
      // be considered console-log-worthy server errors. We will need to
      // differentiate them at some point.
      this._log.error('Error from API call:', response.originalError);
    }

    // Details to log. **TODO:** This will ultimately need to redact some
    // information in the response.

    details.endTime = Date.now();

    if (response.error) {
      details.ok     = false;
      details.error  = response.originalError;
    } else {
      details.ok     = true;
      details.result = response.result;
    }

    this._log.event.apiReturned(details);
  }

  /**
   * Logs an incoming message. This should be called just after the message was
   * decoded off of an incoming connection.
   *
   * @param {Message} msg Incoming message.
   */
  incomingMessage(msg) {
    const details = {
      msg: ApiLog._redactMessage(msg),
      startTime: Date.now()
    };

    this._pending.set(msg, details);

    this._log.event.apiReceived(details);
  }

  /**
   * Logs a response that doesn't have a corresponding incoming message.
   *
   * @param {Response} response Response which was sent.
   */
  nonMessageResponse(response) {
    const now = Date.now();
    const details = {
      msg:       null,
      startTime: now,
      endTime:   now,
      ok:        false,
      error:     response.originalError
    };

    // **TODO:** This will ultimately need to redact some information beyond
    // what `_redactMessage()` might have done.
    this._log.event.apiReturned(details);
  }

  /**
   * Performs redaction on a message, so as to avoid logging sensitive security
   * and user-data details.
   *
   * @param {Message} msg The original message.
   * @returns {Message} The redacted form.
   */
  static _redactMessage(msg) {
    const targetId = msg.targetId;

    if (Auth.isToken(targetId)) {
      const token = Auth.tokenFromId(targetId);
      msg = msg.withTargetId(token.printableId);
    }

    // **TODO:** This will ultimately need to do more redaction.
    return msg;
  }
}
