#!/usr/bin/env node
// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
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
import { inspect } from 'util';

import { Application, Monitor } from '@bayou/app-setup';
import { ClientBundle } from '@bayou/client-bundle';
import { injectAll } from '@bayou/config-common-default';
import { DevMode } from '@bayou/dev-mode';
import { Dirs, ProductInfo, ServerEnv } from '@bayou/env-server';
import { Hooks } from '@bayou/hooks-server';
import { Delay } from '@bayou/promise-util';
import { Logger } from '@bayou/see-all';
import { HumanSink, FileSink } from '@bayou/see-all-server';
import { ClientTests, ServerTests } from '@bayou/testing-server';


/** {Logger} Logger for this file. */
const log = new Logger('main');

/**
 * Runs the system. `mode` options are:
 *
 * * `production` &mdash; Normal production run.
 * * `dev` &mdash; Development. This enables `/debug` endpoints.
 * * `dev-if-appropriate` &mdash; Like `dev` or `production`, depending on what
 *   the salient `server-hook` indicates.
 * * `test` &mdash; Configured for live testing.
 *
 * @param {string} mode The mode as described above.
 * @param {boolean} [doMonitor = false] Whether or not to enable the monitoring
 *   endpoints.
 * @returns {Int} The port being listened on, once listening has started.
 */
async function run(mode, doMonitor = false) {
  // Inject all the system configs. **TODO:** This module needs to be split
  // apart such that a _different_ "main" module can choose to perform different
  // configuration and still reuse most of the code defined in _this_ module.
  injectAll();

  // Give the overlay a chance to do any required early initialization.
  // **TODO:** This is the old way of doing configuration, as opposed to using
  // {@link @bayou/injecty#inject}, and should be transitioned over to that
  // style.
  await Hooks.theOne.run();

  // Set up the server environment bits (including, e.g. the PID file).
  await ServerEnv.theOne.init();

  // A little spew to identify us.
  const info = ProductInfo.theOne.INFO;
  for (const k of Object.keys(info)) {
    log.info(k, '=', info[k]);
  }

  // A little spew to indicate where in the filesystem we live.
  log.info(
    'Directories:\n' +
    `  product: ${Dirs.theOne.BASE_DIR}\n` +
    `  var:     ${Dirs.theOne.VAR_DIR}`);

  if (mode === 'dev-if-appropriate') {
    if (Hooks.theOne.isRunningInDevelopment()) {
      mode = 'dev';
    } else {
      mode = 'production';
    }
  }

  log.info('Running in mode:', mode);

  if (mode === 'dev') {
    // We're in dev mode. This starts the system that live-syncs the client
    // source.
    DevMode.theOne.start();
  }

  /** The main app server. */
  const theApp = new Application(mode !== 'production');

  // Start the app! The result is the port that it ends up listening on.
  const result = theApp.start(mode === 'test');

  if (doMonitor) {
    const monitorPort = Hooks.theOne.monitorPort;
    if (monitorPort !== null) {
      try {
        const monitor = new Monitor(theApp, monitorPort);
        await monitor.start();
      } catch (e) {
        // Log the error, but soldier on.
        log.error('Could not start monitor server!', e);
      }
    }
  }

  return result;
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
  // Figure out if there is already a server listening on the designated
  // application port. If not, run one locally in this process.

  const alreadyRunning = await ServerEnv.theOne.isAlreadyRunningLocally();
  let port;

  if (alreadyRunning) {
    port = Hooks.theOne.listenPort;
    log.info(
      'NOTE: There is a server already running on this machine. The client test run\n' +
      '      will issue requests to it instead of trying to build a new test bundle.');
  } else {
    // Start up a server in this process, since we determined that this machine
    // isn't already running one. We run in test mode so that it will pick a
    // free port (instead of assuming the usual one is available; it likely
    // won't be if the tests are running on a shared machine) and will make the
    // `/debug` endpoints available.
    port = await run('test');

    // Wait a few seconds, so that we can be reasonably sure that the request
    // handlers are ready to handle requests. And there's no point in issuing
    // a request until the test code bundle is built, anyway; that takes at
    // least this long (probably longer).
    await Delay.resolve(15 * 1000);
  }

  const anyFailed = await ClientTests.run(port, testOut || null);

  process.exit(anyFailed ? 1 : 0);
}

/**
 * Does a server testing run.
 */
async function serverTest() {
  const anyFailed = await ServerTests.run(testOut || null);

  process.exit(anyFailed ? 1 : 0);
}

process.on('unhandledRejection', (reason, promise_unused) => {
  // Write to `stdout` directly first, because logging might be broken.
  process.stderr.write('Unhandled promise rejection:\n');
  if (reason instanceof Error) {
    process.stderr.write(reason.stack);
  } else {
    process.stderr.write(inspect(reason));
  }
  process.stderr.write('\n');

  log.error('Unhandled promise rejection:', reason);

  // Give the system a moment, so it has a chance to actually flush the log,
  // and then exit.
  (async () => {
    await Delay.resolve(250); // 0.25 second.
    process.exit(1);
  })();
});

process.on('uncaughtException', (error) => {
  // Write to `stderr` directly first, because logging might be broken.
  process.stderr.write('Uncaught error:\n');
  process.stderr.write(error.stack);
  process.stderr.write('\n');

  log.error('Uncaught error:', error);

  // Give the system a moment, so it has a chance to actually flush the log,
  // and then exit.
  (async () => {
    await Delay.resolve(250); // 0.25 second.
    process.exit(1);
  })();
});

// Dispatch to the selected top-level function.

switch (executionMode) {
  case 'client-bundle': {
    new HumanSink(null, true);
    clientBundle();
    break;
  }

  case 'client-test': {
    new HumanSink(null, true);
    clientTest();
    break;
  }

  case 'server-test': {
    new HumanSink(null, true);
    serverTest();
    break;
  }

  default: {
    const humanLogFile = path.resolve(Dirs.theOne.LOG_DIR, 'general.txt');
    const jsonLogFile = path.resolve(Dirs.theOne.LOG_DIR, 'general.json');

    new FileSink(jsonLogFile, !humanConsole);
    new HumanSink(humanLogFile, humanConsole);

    HumanSink.patchConsole();

    run(executionMode, true);
    break;
  }
}
