// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { format, inspect } from 'util';

import { CommonBase } from 'util-common';

/**
 * Mocha reporter, similar to its built-in "JSON stream" reporter, but
 * specifically tailored to emit exactly the right info for collection on our
 * server side. See {@link testing-server.ClientTests} for the consuming code.
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
        this._emit('suite', suite.title);
      }

      this._suiteDepth++;
    });

    runner.on('suite end', () => {
      this._suiteDepth--;
      this._emit((this._suiteDepth === 0) ? 'done' : 'suiteEnd');
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

    this._emit('test', {
      title:    test.title,
      console:  this._console,
      duration: test.duration || 0,
      error:    (error === null) ? null : inspect(error),
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
