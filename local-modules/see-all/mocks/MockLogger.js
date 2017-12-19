// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseLogger } from 'see-all';

/**
 * Mock logger, which provides a convenient record of how it was called.
 */
export default class MockLogger extends BaseLogger {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    /** {array<array>} Array of logged items. */
    this.record = [];
  }

  // **TODO:** Arguably ought to do something better.
  withAddedContext(...context_unused) {
    // Ignore it.
    return this;
  }

  /**
   * Actual logging implementation. Subclasses must override this to do
   * something appropriate.
   *
   * @abstract
   * @param {string} level Severity level. Guaranteed to be a valid level.
   * @param {array} message Array of arguments to log.
   */
  _impl_log(level, message) {
    this.record.push([level, ...message]);
  }
}
