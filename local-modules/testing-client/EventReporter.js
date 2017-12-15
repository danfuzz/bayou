// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { format, inspect } from 'util';

import { CommonBase, ErrorUtil } from 'util-common';

/**
 * Mocha reporter, similar to its built-in "JSON stream" reporter, but
 * specifically tailored to emit exactly the right info for collection on our
 * server side. See {@link testing-server.EventReceiver} for the consuming code.
 */
export default class EventReporter extends CommonBase {
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
      // Don't emit an event for the anonymous top-level suite.
      if (this._suiteDepth !== 0) {
        this._emit('suiteStart', suite.title);
      }

      this._suiteDepth++;
    });

    runner.on('suite end', () => {
      this._suiteDepth--;
      this._emit((this._suiteDepth === 0) ? 'allDone' : 'suiteEnd');
    });

    runner.on('pending', (test) => {
      this._emitResult(test, 'pending');
    });

    runner.on('pass', (test) => {
      this._emitResult(test, 'pass');
    });

    runner.on('fail', (test, error) => {
      this._emitResult(test, 'fail', error);
    });
  }

  /**
   * Emits a test result.
   *
   * @param {mocha.Test} test The test that was run.
   * @param {string} status Its success status.
   * @param {*} [error = null] Cause of failure, if any.
   */
  _emitResult(test, status, error = null) {
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
        // Handle expected/actual diffing specially. In particular, we don't
        // want to try to pass nontrivial objects across the client/server
        // boundary, so stringify them here.
        //
        // **Note:** As of this writing, the browser polyfill for
        // `util.inspect()` doesn't respect `breakLength`, which means that we
        // too often end up with single-line results for arrays and objects.
        // **TODO:** Get this fixed upstream.
        const inspectOpts = { depth: 8, breakLength: 10 };
        extras = {
          showDiff: true,
          actual:   inspect(error.actual,   inspectOpts),
          expected: inspect(error.expected, inspectOpts)
        };
      }

      const skipExtras = ['message', 'stack', 'showDiff', 'actual', 'expected'];
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

    // **Note:** The payload here ends up getting consumed in
    // {@link testing-server.TestCollector}.
    this._emit('testResult', {
      title:    test.title,
      console:  this._console,
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

  /**
   * Emit an event for consumption by the ultimate test reporter. Each emitted
   * event is in the form of a JSON-encoded array consisting of a string (event
   * name) followed by zero or more event-specific arguments, preceded by the
   * distinctive string `:::MOCHA:::` to make it easy to parse out from other
   * console spew.
   *
   * @param {string} name Event name.
   * @param {...*} args Event-specific arguments.
   */
  _emit(name, ...args) {
    const event = [name, ...args];
    this._originalLog(':::MOCHA::: %s', JSON.stringify(event));
  }
}
