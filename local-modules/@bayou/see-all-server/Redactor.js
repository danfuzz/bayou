// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Logging } from '@bayou/config-server';
import { UtilityClass } from '@bayou/util-common';

/**
 * Utility class for log redaction.
 */
export default class Redactor extends UtilityClass {
  /**
   * Redacts the given record.
   *
   * @param {LogRecord} logRecord The record to redact.
   * @returns {LogRecord} The redacted version of `logRecord`, or `logRecord`
   *   itself if no redaction is necessary.
   */
  static redact(logRecord) {
    // There are typically three logging sinks, and each one calls `redact()`
    // separately. So, to avoid redoing the work, we cache the last record we've
    // seen along with its redacted result. **TODO:** This would be unnecessary
    // (and cleaner) if redaction were performed earlier in the logging call
    // chain.

    if (logRecord === Redactor._lastRecord) {
      return Redactor._lastResult;
    }

    const result = Redactor._doRedaction(logRecord);

    Redactor._lastResult = result;

    return result;
  }

  /**
   * Main implementation of {@link #redact}, which does most of the work.
   *
   * @param {LogRecord} logRecord The record to redact.
   * @returns {LogRecord} The redacted version of `logRecord`, or `logRecord`
   *   itself if no redaction is necessary.
   */
  static _doRedaction(logRecord) {
    if (logRecord.isMessage()) {
      const message    = logRecord.payload.args;
      const newMessage = Logging.redactMessage(...message);

      if (message !== newMessage) {
        logRecord = logRecord.withMessage(...newMessage);
      }
    } else if (logRecord.isEvent()) {
      const payload    = logRecord.payload;
      const newPayload = Logging.redactEvent(payload);

      if (payload !== newPayload) {
        logRecord = logRecord.withEvent(newPayload);
      }
    }

    // **TODO:** If it turns out that tag redaction churn is a performance
    // bottleneck, we might want to memoize / cache `tag -> redacted`
    // calculations.
    const tag    = logRecord.tag;
    const newTag = Logging.redactTag(tag);

    return (tag === newTag) ? logRecord : logRecord.withTag(newTag);
  }
}
