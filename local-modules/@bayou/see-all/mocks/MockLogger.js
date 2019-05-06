// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseLogger } from '@bayou/see-all';

/**
 * Mock logger, which provides a convenient record of how it was called.
 */
export class MockLogger extends BaseLogger {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    /** {array<string>} Context to log per item. */
    this._context = Object.freeze([]);

    /** {array<array>} Array of logged items. */
    this._record = [];

    Object.seal(this);
  }

  get record() {
    return this._record;
  }

  _impl_logEvent(payload) {
    this.record.push(['event', this._context, payload]);
  }

  _impl_logMessage(level, message) {
    this.record.push([level, this._context, ...message]);
  }

  _impl_withAddedContext(...context) {
    const result = new MockLogger();

    // Make the result (a) have additional context, and (b) point its `record`
    // at this instance.

    result._context = Object.freeze([...this._context, ...context]);
    result._record  = this._record;

    return result;
  }
}
