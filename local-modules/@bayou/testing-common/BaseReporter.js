// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { format, inspect } from 'util';

import { CommonBase, DataUtil, ErrorUtil } from '@bayou/util-common';

/**
 * Mocha reporter which "re-envisions" Mocha's various events as a simpler set
 * of calls on abstract methods of itself. There are client- and server-specific
 * subclasses of this class, which plumb the information in different ways,
 * ultimately landing in an instance of
 * {@link @bayou/testing-server.TestCollector}.
 */
export class BaseReporter extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {mocha.Runner} runner The Mocha test driver.
   * @param {*} options_unused Options as originally passed to the `Mocha`
   *   constructor.
   */
  constructor(runner, options_unused) {
    super();

    /** {Int} Current depth of suites. */
    this._suiteDepth = 0;

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
      // Don't make an `_impl_suite()` call for the anonymous top-level suite.
      if (this._suiteDepth !== 0) {
        this._impl_suiteStart(suite.title);
      }

      this._suiteDepth++;
    });

    runner.on('suite end', () => {
      this._suiteDepth--;

      // Don't make an `_impl_suiteEnd()` call for the anonymous top-level
      // suite.
      if (this._suiteDepth !== 0) {
        this._impl_suiteEnd();
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

  /**
   * Standard Mocha reporter method. This always gets called when testing is
   * complete. By way of contrast, if there are no tests run (e.g. because the
   * specified filter matches no tests), then the runner emits no events, and so
   * nothing else on this class will get called.
   *
   * @param {Int} failures The number of test failures.
   * @param {function|undefined} fn Optional function to call with `failures` as
   *   an argument.
   */
  done(failures, fn) {
    this._impl_allDone();

    if (fn) {
      fn(failures);
    }
  }

  /**
   * Handles an `allDone` event.
   *
   * @abstract
   */
  _impl_allDone() {
    this._mustOverride();
  }

  /**
   * Handles a `suiteStart` event.
   *
   * @abstract
   * @param {string} title The suite title.
   */
  _impl_suiteStart(title) {
    this._mustOverride(title);
  }

  /**
   * Handles a `suiteEnd` event.
   *
   * @abstract
   */
  _impl_suiteEnd() {
    this._mustOverride();
  }

  /**
   * Handles a `testResult` event.
   *
   * @abstract
   * @param {object} details Ad-hoc plain object with test details.
   */
  _impl_testResult(details) {
    this._mustOverride(details);
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

  /**
   * Puts together a single test result, and passes it to the subclass's
   * implementation for further handling.
   *
   * @param {mocha.Test} test The test that was run.
   * @param {string} status Its success status.
   * @param {*} [error = null] Cause of failure, if any.
   */
  _testResult(test, status, error = null) {
    // `slice()` to make an independent clone.
    const consoleSnapshot = this._console.slice();
    const duration        = test.duration || 0;

    let speed = 'fast';
    if (duration > test.slow()) {
      speed = 'slow';
    } else if (duration > (test.slow() / 2)) {
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

      // **Note:** As of this writing, the browser polyfill for `util.inspect()`
      // doesn't respect `breakLength`, which means that when running client
      // tests, we too often end up with single-line stringified results for
      // arrays and objects. See <https://github.com/defunctzombie/node-util/issues/22>
      // for the issue which (more or less) tracks the problem.
      const inspectOpts = { depth: 8, breakLength: 10 };

      if (error.showDiff) {
        // Handle expected/actual diffing specially. In particular, we want to
        // make the diffing code not have to worry about stringifying (and it's
        // also good that we don't maintain references to stateful objects,
        // _and_ this code is also used when transporting test results between
        // client and server via JSON-encoded strings), so we stringify here.
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

        // As with `actual` and `expected` above, we can't transport non-data
        // across the "JSON wire" with high fidelity, so we `inspect()` it
        // into a string.
        const value = error[name];
        extras[name] = DataUtil.isData(value) ? value : inspect(value, inspectOpts);
      }

      error = { trace, extras };
    }

    // **Note:** The payload here ultimately ends up getting consumed in
    // {@link @bayou/testing-server.TestCollector}.
    this._impl_testResult({
      title:    test.title,
      console:  consoleSnapshot,
      duration,
      error,
      status,
      speed
    });
  }
}
