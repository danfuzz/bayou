// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

/**
 * Base class for logging sink. Subclasses must implement `log()`.
 *
 * **TODO:** This should follow the usual abstract class pattern and make the
 * methods to implement be named `_impl_*`.
 */
export default class BaseSink extends CommonBase {
  /**
   * Logs a record, as appropriate.
   *
   * @abstract
   * @param {LogRecord} logRecord The record to write.
   */
  log(logRecord) {
    this._mustOverride(logRecord);
  }
}
