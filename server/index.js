// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// This `import` patches Node's backtrace handler so as to make it respect
// source maps (and so produce traces with proper source position info for
// compiled files). We do this as the very first thing upon running, so that
// any exceptions thrown during bootstrap have a reasonable chance of getting
// displayed with an accurate backtrace.
import 'source-map-support/register';

// These `import`s complete the setup of the Babel runtime.
import 'babel-core/register';
import 'babel-polyfill';

import path from 'path';
import puppeteer from 'puppeteer';
import minimist from 'minimist';

import { Application } from 'app-setup';
import { ClientBundle } from 'client-bundle';
import { DevMode } from 'dev-mode';
import { Dirs, ProductInfo, ServerEnv } from 'env-server';
import { Hooks } from 'hooks-server';
import { Delay } from 'promise-util';
import { Logger } from 'see-all';
import { FileSink, ServerSink } from 'see-all-server';
import { ServerTests } from 'testing-server';


/** {Logger} Logger for this file. */
const log = new Logger('main');

/** {boolean} Error during argument processing? */
let argError = false;

/**
 * {object} Parsed command-line options. **Note:** The `slice` gets rid of the
 * `node` binary name and the name of the initial script (that is, this file).
 */
const opts = minimist(process.argv.slice(2), {
  boolean: ['client-bundle', 'client-test', 'dev', 'help', 'server-test'],
  string: ['prog-name'],
  alias: {
    'h': 'help'
  },
  stopEarly: true,
  unknown: (arg) => {
    // eslint-disable-next-line no-console
    console.log(`Unrecognized option: ${arg}`);
    argError = true;
    return false;
  }
});

/** {boolean} Client bundle build mode? */
const clientBundleMode = opts['client-bundle'];

/** {boolean} Client test mode? */
const clientTestMode = opts['client-test'];

/** {boolean} Dev mode? */
const devMode = opts['dev'];

/** {boolean} Server test mode? */
const serverTestMode = opts['server-test'];

/** {boolean} Want help? */
const showHelp = opts['help'];

if ((clientBundleMode + clientTestMode + devMode + serverTestMode) > 1) {
  // eslint-disable-next-line no-console
  console.log('Cannot specify multiple mode options.');
  argError = true;
}

if (showHelp || argError) {
  const progName = opts['prog-name'] || path.basename(process.argv[1]);
  [
    'Usage:',
    '',
    `${progName} [--dev | --client-bundle | --server-test ]`,
    '  Run the project.',
    '',
    '  --client-bundle',
    '    Just build a client bundle, and report any errors encountered.',
    '  --client-test',
    '    Just run the client tests (via headless Chrome), and report any errors',
    '    encountered.',
    '  --dev',
    '    Run in development mode, for interactive development without having',
    '    to restart.',
    '  --server-test',
    '    Just run the server tests, and report any errors encountered.',
    '',
    `${progName} [--help | -h]`,
    '  Display this message.'
  ].forEach((line) => {
    // eslint-disable-next-line no-console
    console.log(line);
  });
  process.exit(argError ? 1 : 0);
}

/**
 * Runs the system normally or in dev mode.
 *
 * @param {boolean} dev Whether or not to use dev mode.
 */
function run(dev) {
  // Set up the server environment bits (including, e.g. the PID file).
  ServerEnv.init();

  // A little spew to identify us.
  const info = ProductInfo.theOne.INFO;
  for (const k of Object.keys(info)) {
    log.info(k, '=', info[k]);
  }

  if (dev) {
    // We're in dev mode. This starts the system that live-syncs the client
    // source.
    DevMode.theOne.start();
  }

  Hooks.theOne.run();

  /** The main app server. */
  const theApp = new Application(dev);

  // Start the app!
  theApp.start();
}

/**
 * Does a client bundling.
 */
async function clientBundle() {
  try {
    await new ClientBundle().build();
    log.info('');
    log.info('Built client bundles. No errors!');
    process.exit(0);
  } catch (e) {
    log.error(e);
    process.exit(1);
  }
}

/**
 * Does a client testing run.
 */
async function clientTest() {
  // Set up and start up headless Chrome (via Puppeteer).
  const browser = await puppeteer.launch();
  const page    = await browser.newPage();
  const testLog = new Logger('client-test');

  page.on('console', (msg) => {
    testLog.info(`[${msg.type}] ${msg.text}`);
  });

  // **TODO:** This whole arrangement is a bit hacky. Ideally, we'd use a
  // different test output formatter that works better with this use case.

  // Start up the system in dev mode, so that we can point our Chrome instance
  // at it.
  try {
    run(true); // `true` === dev mode.

    // Wait a few seconds, so that we can be reasonably sure that the request
    // handlers are ready to handle requests.
    await Delay.resolve(15 * 1000);
  } catch (e) {
    // The `run()` call failed. Check to see if it's because the port is in use.
    // If so, we assume it's because this is being run on an engineer's
    // individual dev box which is already running the server. So, we can just
    // issue the request to that other server.
    if ((e.syscall === 'listen') && (e.code === 'EADDRINUSE')) {
      testLog.info(
        'NOTE: There is another server already running on this machine.\n' +
        '      Will issue requests to it instead of trying to build a new test bundle.');
    } else {
      // Not what we expected. Rethrow and let the system exit.
      throw e;
    }
  }

  testLog.info('Issuing request to start test run...');

  // Issue the request to load up the client tests.
  const url = `http://localhost:${Hooks.theOne.listenPort}/debug/client-test`;
  await page.goto(url, { waitUntil: 'load' });

  // Now wait until the test run is complete. This happens an indeterminate
  // amount of time after the page is done loading (typically a few seconds).
  // During the intervening time, the page contents get updated with test
  // information and results. We poll until the content settles.
  let text = '';
  for (;;) {
    testLog.info('Waiting for test run to complete...');
    const newText = await page.evaluate('document.querySelector("body").innerText');
    if (newText === text) {
      break;
    }

    text = newText;
    await Delay.resolve(1000);
  }

  // Figure out if there were any failures.
  const textStart = text.slice(0, 500);
  const failMatch = textStart.match(/failures: ([0-9]+)/);
  const failures  = failMatch ? failMatch[1] : '(undetermined)';
  const anyFailed = (failures !== '0');

  // Clean up, print out the results, and exit.
  await browser.close();
  testLog.info('Test run is complete!');
  console.log('%s', text); // eslint-disable-line no-console

  const msg = anyFailed
    ? `Failed: ${failures}`
    : 'All good! Yay!';
  console.log('\n%s', msg); // eslint-disable-line no-console

  process.exit(anyFailed ? 1 : 0);
}

/**
 * Does a server testing run.
 */
async function serverTest() {
  // TODO: Arguably this call shouldn't be necessary. (That is, the test code
  // that cares about server env stuff should arrange for its appropriate
  // initialization and perhaps even teardown.)
  ServerEnv.init();

  const failures  = await ServerTests.runAll();
  const anyFailed = (failures !== 0);

  const msg = anyFailed
    ? `Failed: ${failures}`
    : 'All good! Yay!';
  console.log('\n%s', msg); // eslint-disable-line no-console

  process.exit(anyFailed ? 1 : 0);
}

// Initialize logging.

ServerSink.init();
new FileSink(path.resolve(Dirs.theOne.LOG_DIR, 'general.log'));

process.on('unhandledRejection', (reason, promise_unused) => {
  log.error('Unhandled promise rejection:', reason);

  // Give the system a moment, so it has a chance to actually flush the log,
  // and then exit.
  (async () => {
    await Delay.resolve(250); // 0.25 second.
    process.exit(1);
  })();
});

process.on('uncaughtException', (error) => {
  log.error('Uncaught error:', error);

  // Give the system a moment, so it has a chance to actually flush the log,
  // and then exit.
  (async () => {
    await Delay.resolve(250); // 0.25 second.
    process.exit(1);
  })();
});

// Dispatch to the selected top-level function.

if (clientBundleMode) {
  clientBundle();
} else if (clientTestMode) {
  clientTest();
} else if (serverTestMode) {
  serverTest();
} else {
  run(devMode);
}
