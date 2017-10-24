// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { reporters } from 'mocha';

import { CommonBase } from 'util-common';

/**
 * Mocha reporter which uses its built-in `spec` reporter to write to the
 * console while also collecting data for eventual writing to a file.
 */
export default class CollectingReporter extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {mocha.Runner} runner The Mocha test driver.
   * @param {*} options Options as originally passed to the `Mocha` constructor.
   */
  constructor(runner, options) {
    super();

    // Store `this` in the array which we got passed in as a "reporter option,"
    // because Mocha has no better way to provide access to the reporter
    // instance that it constructed. See `ServerTests` in this module for the
    // code that consumes this value.
    options.reporterOptions.holder[0] = this;

    /** {object} Mocha's default `spec` reporter. */
    this._specReporter = new reporters.spec(runner);

    /** {array<mocha.Suite>} Current stack of active test suites. */
    this._suites = [];

    /**
     * {array<{ test, status, suites }>} Array of collected test results, each
     * an ad-hoc plain object.
     */
    this._results = [];

    runner.on('suite', (suite) => {
      this._suites.push(suite);
    });

    runner.on('suite end', () => {
      this._suites.pop();
    });

    runner.on('pending', (test) => {
      this._addResult(test, 'pending');
    });

    runner.on('pass', (test) => {
      this._addResult(test, 'pass');
    });

    runner.on('fail', (test) => {
      this._addResult(test, 'fail');
    });
  }

  /**
   * Gets a list of output lines representing the test results, suitable for
   * writing to a file.
   *
   * @returns {array<string>} Output lines.
   */
  resultLines() {
    const lines = [];
    const stats = { fail: 0, pass: 0, pending: 0 };

    for (const { test, status, suites } of this._results) {
      const testPath = [...suites.map(s => s.title), test.title].join(' / ');
      const speed = (test.speed === 'fast') ? '' : ', ${test.speed}ms';
      const statusStr = `(${status}${speed})`;

      lines.push(`${statusStr} ${testPath}`);
      stats[status]++;
    }

    lines.push('');
    lines.push('Summary:');
    lines.push(`  Total:  ${stats.tests}`);
    lines.push(`  Passed: ${stats.pass}`);
    lines.push(`  Failed: ${stats.fail}`);
    lines.push('');
    lines.push((stats.fail === 0) ? 'All good! Yay!' : 'Alas.');

    return lines;
  }

  /**
   * Adds a single test result to the accumulated list of same.
   *
   * @param {mocha.Test} test The test that was run.
   * @param {string} status Its success status.
   */
  _addResult(test, status) {
    // `slice(1)` because we don't care about the anonymous top-level suite.
    const suites = this._suites.slice(1);
    this._results.push({ test, status, suites });
  }
}
