// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import puppeteer from 'puppeteer';
import { format, promisify } from 'util';

import { Delay, Mutex } from '@bayou/promise-util';
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

    // We need to do some async stuff in the `console` handler. This mutex
    // serializes handling so that we deal with each message fully and in-order.
    // If we saw messages out of order, then (a) it's confusing in general, and
    // (b) the test output parser would get messed up.
    const consoleMutex = new Mutex();

    async function handleConsole(consoleMessage) {
      const args = consoleMessage.args();
      const type = consoleMessage.type();

      if (args.length === 0) {
        // Shouldn't happen, but just in case it does, exit early instead of
        // getting more confused below.
        return;
      }

      switch (type) {
        case 'debug':
        case 'error':
        case 'info':
        case 'log':
        case 'warning': {
          // Handle these.
          break;
        }
        default: {
          // Don't try to handle any other message type.
          return;
        }
      }

      // Convert each of the arguments from a remote handle to a local data
      // value. These are almost always, but not necessarily, strings.
      const jsonArgs  = await Promise.all(args.map(a => a.jsonValue()));
      const arg0      = jsonArgs[0];
      let   formatted;

      // Dispose the handles, so that the client can GC whatever was generated
      // from the logging.
      await Promise.all(args.map(a => a.dispose()));

      if ((typeof arg0 === 'string') && (arg0.indexOf('%') >= 0)) {
        // The first argument is a presumptive format string. Convert `%c` to
        // `%s` (because the browser uses the former but Node doesn't understand
        // it), and then format the result. **Note:** The conversion of `%c`
        // doesn't actually produce colored output, but that doesn't really
        // matter in this context.
        const formatStr = arg0.replace(/%c/g, '%s');
        formatted = format(formatStr, ...jsonArgs.slice(1));
      } else {
        formatted = format('%s', ...jsonArgs);
      }

      receiver.consoleLine(formatted);
    }

    page.on('console', (consoleMessage) => {
      consoleMutex.withLockHeld(() => handleConsole(consoleMessage));
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
