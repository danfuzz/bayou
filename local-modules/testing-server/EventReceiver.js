// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import chalk from 'chalk';
import { inspect } from 'util';

import { CommonBase } from 'util-common';

/**
 * {object} Object that maps each possible test status to an ad-hoc set of
 * info about how to mark it up.
 */
const TEST_STATUS_MARKUP = {
  fail:    { char: '✖', color: chalk.red,   colorTitle: false },
  pass:    { char: '✓', color: chalk.green, colorTitle: false },
  pending: { char: '-', color: chalk.cyan,  colorTitle: true },
  unknown: { char: '?', color: chalk.red,   colorTitle: true }
};

/** {object} Colors to use for non-fast speed markup. */
const SPEED_COLOR = {
  medium: chalk.yellow,
  slow:   chalk.red
};

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

    /** {array<string>} Array of collected test result lines. */
    this._resultLines = [];

    /** {array<string>} Array of non-test browser console output lines. */
    this._nonTestLines = [];

    /**
     * {array<string>} Array of reported test failures, for recapitulation at
     * the end of the results.
     */
    this._failLines = [];

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
   * {array<string>} Array of non-test browser console output lines. This ends
   * up getting used when reporting test infrastucture failures (as opposed to
   * failures in the tests themselves).
   */
  get nonTestLines() {
    return this._nonTestLines;
  }

  /**
   * {array<string>} A list of output lines representing the test results,
   * suitable for writing to a file.
   */
  get resultLines() {
    return this._resultLines;
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
   * Logs a test result line.
   *
   * @param {string} line Line to log.
   */
  _log(line) {
    this._resultLines.push(line);

    // eslint-disable-next-line no-console
    console.log('%s', line);
  }

  /**
   * Handles a `done` event.
   */
  _handle_done() {
    this._done = true;

    if (this._failLines.length !== 0) {
      for (const line of this._failLines) {
        this._log(line);
      }
    }

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

    if (this._suites.length === 1) {
      title = chalk.bold(title);
    }

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

    const prefix     = '  '.repeat(this._suites.length + 1);
    const speed      = details.speed;
    const markup     = TEST_STATUS_MARKUP[details.status] || TEST_STATUS_MARKUP.unknown;
    const speedColor = SPEED_COLOR[speed] || chalk.gray;
    const statusChar = markup.color(markup.char);
    const speedStr = (speed === 'fast')
      ? ''
      : `\n${prefix}  ` + speedColor(`(${speed} ${details.duration}ms)`);

    // Indent the second-and-later title lines so they line up under the first
    // line.
    const title    = details.title.replace(/\n/g, `\n${prefix}  `);
    const titleStr = markup.colorTitle ? markup.color(title) : title;
    this._log(`${prefix}${statusChar} ${titleStr}${speedStr}`);

    const lines = EventReceiver._linesForTest(details);

    if (lines.length !== 0) {
      this._log('');
      for (const l of lines) {
        this._log(`${prefix}${l}`);
      }
    }

    if (details.status === 'fail') {
      let titlePrefix = '';

      for (const s of this._suites) {
        this._failLines.push(`${titlePrefix}${s}`);
        titlePrefix += '  ';
      }

      this._failLines.push(`${titlePrefix}${details.title}`);
      this._failLines.push('');

      for (const l of lines) {
        this._failLines.push(`  ${l}`);
      }
    }
  }

  /**
   * Produces a set of lines to log for a given test, _except_ for a header.
   * Always includes a blank line at the end if there are any lines at all.
   *
   * @param {object} details Test result details.
   * @returns {array<string>} The lines to log. Elements are guaranteed not to
   *   have any newlines in them.
   */
  static _linesForTest(details) {
    const result = [];

    function add(string = '', indent = '') {
      const lines = string.replace(/\n$/, '').split('\n');

      for (const l of lines) {
        result.push(`${indent}${l}`);
      }
    }

    if (details.console.length !== 0) {
      add(details.console);
      add();
    }

    if (details.error !== null) {
      const { trace, extras } = details.error;

      add(trace);

      if (extras !== null) {
        if (extras.showDiff) {
          // **TODO:** Produce a real diff.
          add();
          add('Actual:');
          add(extras.actual, '  ');
          add();
          add('Expected:');
          add(extras.expected, '  ');
          delete extras.showDiff;
          delete extras.actual;
          delete extras.expected;
        }

        if (Object.keys(extras).length !== 0) {
          add();
          add(inspect(extras));
        }
      }

      add();
    }

    return result;
  }
}
