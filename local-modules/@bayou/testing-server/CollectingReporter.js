// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseReporter } from '@bayou/testing-common';

import { TestCollector } from './TestCollector';

/**
 * Mocha reporter which uses its built-in `spec` reporter to write to the
 * console while also collecting data for eventual writing to a file.
 */
export class CollectingReporter extends BaseReporter {
  /**
   * Constructs an instance.
   *
   * @param {mocha.Runner} runner The Mocha test driver.
   * @param {*} options Options as originally passed to the `Mocha` constructor.
   */
  constructor(runner, options) {
    super(runner, options);

    // Store `this` in the array which we got passed in as a "reporter option,"
    // because Mocha has no better way to provide access to the reporter
    // instance that it constructed. See {@link ServerTests} for the code that
    // consumes this value.
    options.reporterOptions.holder[0] = this;

    /** {TestCollector} Collector of all the test results. */
    this._collector = new TestCollector();
  }

  /** {TestCollector} Collector of all the test results. */
  get collector() {
    return this._collector;
  }

  /**
   * Handles an `allDone` event.
   */
  _impl_allDone() {
    this._collector.allDone();
  }

  /**
   * Handles a `suiteStart` event.
   *
   * @param {string} title The suite title.
   */
  _impl_suiteStart(title) {
    this._collector.suiteStart(title);
  }

  /**
   * Handles a `suiteEnd` event.
   */
  _impl_suiteEnd() {
    this._collector.suiteEnd();
  }

  /**
   * Handles a `testResult` event.
   *
   * @param {object} details Ad-hoc plain object with test details.
   */
  _impl_testResult(details) {
    this._collector.testResult(details);
  }
}
