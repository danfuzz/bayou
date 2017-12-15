// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import chalk from 'chalk';
import { createTwoFilesPatch } from 'diff';
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
      this._log(chalk.bold.red('Failures:'));
      this._log('');

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
    const topLevel = (this._suites.length === 0);
    const prefix   = '  '.repeat(this._suites.length);

    this._suites.push(title);

    for (const line of EventReceiver._linesForString(title)) {
      this._log(topLevel ? chalk.bold(line) : `${prefix}${line}`);
    }
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

    const prefix     = '  '.repeat(this._suites.length);
    const speed      = details.speed;
    const markup     = TEST_STATUS_MARKUP[details.status] || TEST_STATUS_MARKUP.unknown;
    const speedColor = SPEED_COLOR[speed] || chalk.gray;
    const statusChar = markup.color(markup.char);
    const speedStr   = (speed === 'fast')
      ? ''
      : '\n' + speedColor(`(${speed} ${details.duration}ms)`);
    const titleStr   = `${statusChar} ${details.title}${speedStr}`;
    const titleLines = EventReceiver._linesForString(titleStr);

    let titlePrefix = prefix;
    for (const line of titleLines) {
      this._log(`${titlePrefix}${line}`);
      titlePrefix = `${prefix}  `; // Aligns second-and-later title lines under the first.
    }

    const lines = EventReceiver._linesForTest(details);

    if (lines.length !== 0) {
      this._log('');
      for (const line of lines) {
        this._log(`${prefix}${line}`);
      }
    }

    if (details.status === 'fail') {
      let headerPrefix = '';

      for (const s of this._suites) {
        this._failLines.push(`${headerPrefix}${s}`);
        headerPrefix += '  ';
      }

      this._failLines.push(`${headerPrefix}${details.title}`);
      this._failLines.push('');

      for (const line of lines) {
        this._failLines.push(`  ${line}`);
      }
    }
  }

  /**
   * Produces lines representing the differences between the given two
   * strings.
   *
   * @param {string} actual String representing the actual result of a test.
   * @param {string} expected String representing the expected result of a test.
   * @returns {array<string>} Array of lines.
   */
  static _linesForDiff(actual, expected) {
    const result = [];

    function add(string = '') {
      const lines = string.replace(/\n$/, '').split('\n');

      for (const line of lines) {
        result.push(line);
      }
    }

    // Trim initial newlines and ensure exactly one final newline. (The latter
    // is to prevent the usual "No newline" patch text from showing up.)

    actual   =   actual.replace(/^\n+/, '').replace(/\n*$/, '\n');
    expected = expected.replace(/^\n+/, '').replace(/\n*$/, '\n');

    // Produce the raw patch, and filter it line-by-line into a useful result.

    const patch =
      createTwoFilesPatch('(actual)', '(expected)', actual, expected);

    let firstRangeMark = true;
    function fixLine(line) {
      // This is similar to (but not quite identical to) what Mocha implements
      // in `reporters/Base.unifiedDiff()` (which isn't actually an exported
      // method, alas).
      if (line[0] === '+') {
        return chalk.green(line);
      } else if (line[0] === '-') {
        return chalk.red(line);
      } else if (/^@@/.test(line)) {
        if (firstRangeMark) {
          firstRangeMark = false;
          return '';
        } else {
          return '--';
        }
      } else if (/^==/.test(line)) {
        return null; // The first line of a patch is a wall of `=`s.
      } else {
        return line;
      }
    }

    add();
    for (const line of EventReceiver._linesForString(patch)) {
      const fixed = fixLine(line);
      if (fixed !== null) {
        add(fixed);
      }
    }

    return result;
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

    function add(string = '') {
      const lines = string.replace(/\n$/, '').split('\n');

      for (const line of lines) {
        result.push(line);
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
          for (const line of EventReceiver._linesForDiff(extras.actual, extras.expected)) {
            add(line);
          }
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

  /**
   * Splits a string into an array of individual lines, each optionally
   * prefixed. It also trims away string-initial and string-final newlines.
   *
   * @param {string} s The string to split.
   * @param {string} [prefix = ''] Prefix for each line.
   * @returns {array<string>} Array of lines.
   */
  static _linesForString(s, prefix = '') {
    s = s.replace(/(^\n+)|(\n+$)/g, '');

    const lines = s.split('\n');

    return (prefix === '')
      ? lines
      : lines.map(line => `${prefix}${line}`);
  }
}
