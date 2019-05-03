// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from '@bayou/util-common';

import { TestCollector } from './TestCollector';

/**
 * Receiver of events sent by {@link @bayou/testing-client.EventReporter}.
 */
export class EventReceiver extends CommonBase {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    /** {TestCollector} Collector of all the test results. */
    this._collector = new TestCollector();

    /** {array<string>} Array of non-test browser console output lines. */
    this._nonTestLines = [];
  }

  /** {TestCollector} Collector of all the test results. */
  get collector() {
    return this._collector;
  }

  /**
   * {array<string>} Array of non-test browser console output lines. This ends
   * up getting used when reporting test infrastucture failures (as opposed to
   * failures in the tests themselves).
   */
  get nonTestLines() {
    return this._nonTestLines;
  }

  /**
   * Accepts and acts on a console line as received from the client.
   *
   * @param {string} line The console line.
   */
  consoleLine(line) {
    const match = line.match(/^:::MOCHA::: (.*)$/);

    if (match === null) {
      // Not an event line.
      this._nonTestLines.push(line);
      return;
    }

    const [name, ...args] = JSON.parse(match[1]);
    this[`_handle_${name}`](...args);
  }

  /**
   * Handles an `allDone` event.
   */
  _handle_allDone() {
    this._collector.allDone();
  }

  /**
   * Handles a `suiteStart` event.
   *
   * @param {string} title The suite title.
   */
  _handle_suiteStart(title) {
    this._collector.suiteStart(title);
  }

  /**
   * Handles a `suiteEnd` event.
   */
  _handle_suiteEnd() {
    this._collector.suiteEnd();
  }

  /**
   * Handles a `testResult` event.
   *
   * @param {object} details Ad-hoc plain object with test details.
   */
  _handle_testResult(details) {
    this._collector.testResult(details);
  }
}
