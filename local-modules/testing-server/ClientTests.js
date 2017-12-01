// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import puppeteer from 'puppeteer';
import { format, promisify } from 'util';

import { Delay } from 'promise-util';
import { Logger } from 'see-all';
import { UtilityClass } from 'util-common';

/** {Logger} Logger for this module. */
const log = new Logger('testing');

/**
 * Indirect driver for the Mocha framework, for client tests.
 */
export default class ClientTests extends UtilityClass {
  /**
   * Sets up and runs client tests, using a captive browser environment.
   *
   * @param {Int} port Localhost port to connect to, to talk to a running
   *   server (which might turn out to be in this process).
   * @param {string|null} testOut If non-`null`, filesystem path to write the
   *   test output to.
   * @returns {boolean} `true` iff there were any test failures.
   */
  static async run(port, testOut) {
    // **TODO:** This whole arrangement is a bit hacky and should be improved.

    // Set up and start up headless Chrome (via Puppeteer).
    const browser  = await puppeteer.launch();
    const page     = await browser.newPage();
    const logLines = [];

    page.on('console', (...args) => {
      // **TODO:** This doesn't quite work, because the first argument can have
      // Chrome-specific `%` escapes in it, which are similar to but not exactly
      // what Node's `util.format()` uses.
      const msg = format(...args);
      logLines.push(msg);
    });

    // Issue the request to load up the client tests.
    const url = `http://localhost:${port}/debug/client-test`;

    log.info(`Issuing request to start test run:\n  ${url}`);

    await page.goto(url, { waitUntil: 'load' });

    // Now wait until the test run is complete. This happens an indeterminate
    // amount of time after the page is done loading (typically a few seconds).
    // During the intervening time, we should see lots of calls to the `console`
    // event handler. We poll and wait until the activity stops.
    let lastChangeAt = Date.now();
    let lastCount    = logLines.length;
    let lastStatus   = lastChangeAt;
    for (;;) {
      const newCount = logLines.length;
      const now      = Date.now();

      if ((now - lastStatus) > (1.5 * 1000)) {
        log.info('Waiting for test run to complete...');
        lastStatus = now;
      }

      if (newCount !== lastCount) {
        lastChangeAt = now;
        lastCount    = newCount;
      } else if ((now - lastChangeAt) > (4 * 1000)) {
        // It's been more than four seconds since there were logs written.
        log.info('Test run is complete!');
        break;
      }

      await Delay.resolve(250);
    }

    // Print out the results, and figure out if there were any failures, report
    // about it, and exit.

    await browser.close();

    const stats = {
      tests: '(undetermined)',
      pass:  '(undetermined)',
      fail:  '(undetermined)'
    };

    const outputLines = [''];

    for (let i = 0; i < logLines.length; i++) {
      const line = logLines[i];
      const match = line.match(/^# (tests|pass|fail) ([0-9]+)$/);

      if (match !== null) {
        stats[match[1]] = match[2];
      }

      outputLines.push(line);
    }

    const anyFailed = (stats.fail !== '0');

    outputLines.push('');
    outputLines.push('Summary:');
    outputLines.push(`  Total:  ${stats.tests}`);
    outputLines.push(`  Passed: ${stats.pass}`);
    outputLines.push(`  Failed: ${stats.fail}`);
    outputLines.push('');
    outputLines.push(anyFailed ? 'Alas.' : 'All good! Yay!');
    outputLines.push('');

    const allOutput = outputLines.join('\n');

    // eslint-disable-next-line no-console
    console.log('%s', allOutput);

    if (testOut) {
      fs.writeFileSync(testOut, allOutput);
      // eslint-disable-next-line no-console
      console.log('Wrote test results to file:', testOut);
    }

    // This ensures that `stdout` (including the `console.log()` output) has
    // been flushed.
    await promisify(cb => process.stdout.write('', 'utf8', cb))();

    return anyFailed;
  }
}
