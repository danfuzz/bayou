// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

import LogRecord from './LogRecord';

/**
 * Base class for logging sinks (that is, a "sink" as a destination for log
 * records). Instances of this class accept {@link LogRecord} instances and
 * durably log them _somewhere_.
 */
export default class BaseSink extends CommonBase {
  /**
   * Logs a record, as appropriate.
   *
   * @param {LogRecord} logRecord The record to log.
   */
  log(logRecord) {
    // **TODO:** Remove this when client sites have been updated.
    this.sinkLog(logRecord);
  }

  /**
   * Accepts a log record, doing whatever is appropriate per the subclass.
   *
   * @param {LogRecord} logRecord The record to log.
   */
  sinkLog(logRecord) {
    // This method exists to (a) perform type checking, and (b) provide the
    // usual main-vs-`_impl_` arrangement for abstract classes.
    LogRecord.check(logRecord);
    this._impl_sinkLog(logRecord);
  }

  /**
   * Subclass-specific log handler.
   *
   * @abstract
   * @param {LogRecord} logRecord The record to log. Guaranteed to be a valid
   *   instance.
   */
  _impl_sinkLog(logRecord) {
    this._mustOverride(logRecord);
  }
}
