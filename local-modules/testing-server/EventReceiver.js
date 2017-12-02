// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

/**
 * Receiver of events sent by {@link testing-client.EventReporter}.
 */
export default class EventReceiver extends CommonBase {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    /** {array<string>} Current stack of the names of active test suites. */
    this._suites = [];

    /**
     * {array<{ test, status, suites, log }>} Array of collected test results,
     * each an ad-hoc plain object.
     */
    this._results = [];

    /** {object} Ad-hoc object with mappings for test category counts. */
    this._stats = { fail: 0, pass: 0, pending: 0, total: 0 };

    /** {boolean} Whether or not we have received the `done` event. */
    this._done = false;
  }

  /** {boolean} Whether or not there were any test failures. */
  get anyFailed() {
    return this._stats.fail !== 0;
  }

  /** {boolean} Whether or not we have received the `done` event. */
  get done() {
    return this._done;
  }

  /**
   * {array<string>} A list of output lines representing the test results,
   * suitable for writing to a file.
   */
  get resultLines() {
    return this._results;
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
      return;
    }

    const [name, ...args] = JSON.parse(match[1]);
    this[`_handle_${name}`](...args);
  }

  /**
   * Logs a test result line.
   *
   * @param {string} line Line to log.
   */
  _log(line) {
    this._results.push(line);

    // eslint-disable-next-line no-console
    console.log('%s', line);
  }

  /**
   * Handles a `done` event.
   */
  _handle_done() {
    this._done = true;

    this._log('');
    this._log('Summary:');
    this._log(`  Total:   ${this._stats.total}`);
    this._log(`  Passed:  ${this._stats.pass}`);
    this._log(`  Failed:  ${this._stats.fail}`);
    this._log(`  Pending: ${this._stats.pending}`);
    this._log('');
    this._log((this._stats.fail === 0) ? 'All good! Yay!' : 'Alas.');
  }

  /**
   * Handles a `suite` event.
   *
   * @param {string} title The suite title.
   */
  _handle_suite(title) {
    this._suites.push(title);
    this._log(`${'  '.repeat(this._suites.length)}${title}`);
  }

  /**
   * Handles a `suiteEnd` event.
   */
  _handle_suiteEnd() {
    this._suites.pop();

    if (this._suites.length === 0) {
      // Separate top-level suites with an extra newline.
      this._log('');
    }
  }

  /**
   * Handles a `test` event.
   *
   * @param {object} details Ad-hoc plain object with test details.
   */
  _handle_test(details) {
    this._stats[details.status]++;
    this._stats.total++;

    const prefix = '  '.repeat(this._suites.length + 1);

    const speed = details.speed;
    const speedStr = (speed === 'fast') ? '' : `, ${speed} ${details.duration}ms`;
    const statusStr = `(${details.status}${speedStr})`;

    this._log(`${prefix}${statusStr} -- ${details.title}`);

    if (details.console.length !== 0) {
      this._log('');
      for (const line of details.console) {
        this._log(`${prefix}${line}`);
      }
    }

    if (details.error !== null) {
      this._log('');
      this._log(details.error);
    }
  }
}
