// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { format, inspect } from 'util';

import { CommonBase, ErrorUtil } from 'util-common';

import TestCollector from './TestCollector';

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
    // instance that it constructed. See {@link ServerTests} for the code that
    // consumes this value.
    options.reporterOptions.holder[0] = this;

    /** {Int} Current depth of suites. */
    this._suiteDepth = 0;

    /** {TestCollector} Collector of all the test results. */
    this._collector = new TestCollector();

    /**
     * {array<string>} Ongoing collected console output, reset for each test.
     */
    this._console = [];

    /** {function} Original value of `console.log`. */
    this._originalLog = console.log; // eslint-disable-line no-console

    runner.on('test', () => {
      console.log = this._log.bind(this); // eslint-disable-line no-console
      this._console = [];
    });

    runner.on('test end', () => {
      console.log = this._originalLog; // eslint-disable-line no-console
    });

    runner.on('suite', (suite) => {
      // Don't emit an event for the anonymous top-level suite.
      if (this._suiteDepth !== 0) {
        this._collector.suiteStart(suite.title);
      }

      this._suiteDepth++;
    });

    runner.on('suite end', () => {
      this._suiteDepth--;
      if (this._suiteDepth === 0) {
        this._collector.allDone();
      } else {
        this._collector.suiteEnd();
      }
    });

    runner.on('pending', (test) => {
      this._testResult(test, 'pending');
    });

    runner.on('pass', (test) => {
      this._testResult(test, 'pass');
    });

    runner.on('fail', (test, error) => {
      this._testResult(test, 'fail', error);
    });
  }

  /** {TestCollector} Collector of all the test results. */
  get collector() {
    return this._collector;
  }

  /**
   * Sends a single test result to the collector.
   *
   * @param {mocha.Test} test The test that was run.
   * @param {string} status Its success status.
   * @param {*} [error = null] Cause of failure, if any.
   */
  _testResult(test, status, error = null) {
    // `slice()` to make an independent clone.
    const consoleSnapshot = this._console.slice();

    let speed = 'fast';
    if (test.duration > test.slow()) {
      speed = 'slow';
    } else if (test.duration > (test.slow() / 2)) {
      speed = 'medium';
    }

    if (error !== null) {
      // Get a trace of the error without any extra properties (as those get
      // pulled out separately, below).
      const pureError = new Error(error.message);
      pureError.name  = error.name;
      pureError.stack = error.stack;
      const fullTrace = ErrorUtil.fullTrace(pureError);

      // Trim off the part of the stack trace that looks like the test harness.
      // Specifically, Mocha (as of this writing) has a method
      // `Test.Runnable.run` which calls a function `callFn`. If this ever
      // changes, then this trimming code will need to be updated.
      const trace = fullTrace.replace(/\n +callFn[^\n]+\n +Test\.Runnable\.run[^]*$/, '\n');

      // Unit test errors often have interesting auxiliary info. Collect such
      // info separately.

      let extras = null;

      if (error.showDiff) {
        // Handle expected/actual diffing specially. In particular, we want to
        // make the diffing code not have to worry about stringifying (and it's
        // also good that we don't maintain references to stateful objects,
        // _and_ this code is also used when transporting test results between
        // client and server), so we stringify here.
        //
        // **Note:** As of this writing, the browser polyfill for
        // `util.inspect()` doesn't respect `breakLength`, which means that we
        // too often end up with single-line results for arrays and objects.
        const inspectOpts = { depth: 8, breakLength: 10 };
        extras = {
          showDiff: true,
          actual:   inspect(error.actual,   inspectOpts),
          expected: inspect(error.expected, inspectOpts)
        };
      }

      const skipExtras = ['name', 'message', 'stack', 'showDiff', 'actual', 'expected'];
      for (const name of Object.getOwnPropertyNames(error)) {
        if (skipExtras.includes(name)) {
          continue;
        } else if (extras === null) {
          extras = {};
        }

        extras[name] = error[name];
      }

      error = { trace, extras };
    }

    this._collector.testResult({
      title:    test.title,
      console:  consoleSnapshot,
      duration: test.duration || 0,
      error,
      status,
      speed
    });
  }

  /**
   * Replacement for `console.log()` which is active when a test is running.
   *
   * @param {...*} args Original arguments to `console.log()`.
   */
  _log(...args) {
    this._originalLog(...args);
    this._console.push(format(...args));
  }
}
