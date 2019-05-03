// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import puppeteer from 'puppeteer';
import { format, promisify } from 'util';

import { Delay } from '@bayou/promise-util';
import { Logger } from '@bayou/see-all';
import { UtilityClass } from '@bayou/util-common';

import { EventReceiver } from './EventReceiver';

/** {Logger} Logger for this module. */
const log = new Logger('testing');

/**
 * Indirect driver for the Mocha framework, for client tests.
 */
export class ClientTests extends UtilityClass {
  /**
   * Sets up and runs client tests, using a captive browser environment.
   *
   * @param {Int} port Localhost port to connect to, to talk to a running
   *   server (which might turn out to be in this process).
   * @param {string|null} testOut If non-`null`, filesystem path to write the
   *   test output to.
   * @param {RegExp|null} testFilter Filter on test names.
   * @returns {boolean} `true` iff there were any test failures.
   */
  static async run(port, testOut, testFilter) {
    // **TODO:** This whole arrangement is a bit hacky and should be improved.

    // Set up and start up headless Chrome (via Puppeteer).

    const browser   = await puppeteer.launch();
    const page      = await browser.newPage();
    const receiver  = new EventReceiver();
    const collector = receiver.collector;

    page.on('console', (...args) => {
      // **TODO:** This doesn't quite work, because the first argument can have
      // Chrome-specific `%` escapes in it, which are similar to but not exactly
      // what Node's `util.format()` uses.
      const msg = format(...args);
      receiver.consoleLine(msg);
    });

    page.on('pageerror', (err) => {
      // Puppeteer passes in an `err` which is an `Error` whose _message_ is
      // the complete originally-thrown trace. The stack trace of `err` itself
      // represents just the local side and is (by and large) uninteresting.
      const lines = err.message.split('\n');
      receiver.consoleLine('Uncaught error:');
      for (const line of lines) {
        receiver.consoleLine(`  ${line}`);
      }
    });

    // Issue the request to load up the client tests.

    const regexParam = testFilter
      ? `/${encodeURIComponent(testFilter.source)}`
      : '';

    const url = `http://localhost:${port}/debug/client-test${regexParam}`;

    log.info(`Issuing request to start test run:\n  ${url}`);

    // Wait up to two minutes for the page to finish loading. It should
    // typically be much quicker than that; we just leave plenty of leeway in
    // case the machine under test happens to be running under heavy load.

    await page.goto(url, { waitUntil: 'load', timeout: 2 * 60 * 1000 });

    // Now wait until the test run is complete. This happens an indeterminate
    // amount of time after the page is done loading (typically a few seconds).
    // During the intervening time, we should see lots of calls to the `console`
    // event handler. We poll and wait until we get the "done" event.

    const startTime  = Date.now();
    let   lastStatus = startTime;
    for (;;) {
      if (collector.done) {
        log.info('Test run is complete!');
        break;
      }

      const now = Date.now();

      if ((now - lastStatus) > (2.5 * 1000)) {
        log.info('Waiting for test run to complete...');
        lastStatus = now;
      } else if ((now - startTime) > (60 * 1000)) {
        log.error('Taking way too long to run tests!');

        // The non-test console spew from the client might turn out to be
        // useful, so log it.
        const output = receiver.nonTestLines.join('\n');
        log.info(output);
        break;
      }

      await Delay.resolve(250);
    }

    // Print out the results, and figure out if there were any failures, report
    // about it, and exit.

    await browser.close();

    if (!collector.done) {
      return true;
    }

    if (testOut) {
      const allOutput = collector.resultLines.join('\n');

      fs.writeFileSync(testOut, allOutput);
      // eslint-disable-next-line no-console
      log.info('Wrote test results to file:', testOut);
    }

    // This ensures that `stdout` (including the `console.log()` output) has
    // been flushed.
    await promisify(cb => process.stdout.write('', 'utf8', cb))();

    return collector.anyFailed;
  }
}
