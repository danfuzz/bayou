#!/usr/bin/env node
// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import path from 'path';

import { Application, Monitor } from '@bayou/app-setup';
import { injectAll } from '@bayou/config-common-default';
import { DevMode } from '@bayou/dev-mode';
import { Dirs, ProductInfo, ServerEnv } from '@bayou/env-server';
import { Hooks } from '@bayou/hooks-server';
import { Logger } from '@bayou/see-all';
import { HumanSink, FileSink } from '@bayou/see-all-server';
import { Action, Options, TopErrorHandler } from '@bayou/server-top';

TopErrorHandler.init();

/** {Logger} Logger for this file. */
const log = new Logger('main');

/** {Options} Parsed command-line arguments / options. */
const options = new Options(process.argv);

if (options.errorMessage !== null) {
  // eslint-disable-next-line no-console
  console.log(`${options.errorMessage}\n`);
  options.usage();
  process.exit(1);
}

/**
 * Runs the system.
 *
 * @param {string} action The action as described by {@link Options}.
 * @param {boolean} [doMonitor = false] Whether or not to enable the monitoring
 *   endpoints.
 * @returns {Int} The port being listened on, once listening has started.
 */
async function run(action, doMonitor = false) {
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

  if (action === 'dev-if-appropriate') {
    if (Hooks.theOne.isRunningInDevelopment()) {
      action = 'dev';
    } else {
      action = 'production';
    }
  }

  log.info('Running action:', action);

  if (action === 'dev') {
    // We're in dev mode. This starts the system that live-syncs the client
    // source.
    DevMode.theOne.start();
  }

  /** The main app server. */
  const theApp = new Application(action !== 'production');

  // Start the app! The result is the port that it ends up listening on.
  const result = theApp.start(action === 'client-test');

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

// Dispatch to the selected top-level function.

let resultPromise = null;

switch (options.action) {
  case 'client-bundle':
  case 'client-test':
  case 'help':
  case 'server-test': {
    resultPromise = new Action(options).run();
    break;
  }

  default: {
    const humanLogFile = path.resolve(Dirs.theOne.LOG_DIR, 'general.txt');
    const jsonLogFile = path.resolve(Dirs.theOne.LOG_DIR, 'general.json');

    // Second argument to both of these constructors is a boolean `useConsole`
    // which indicates (when `true`) that the sink in question should also write
    // to the console.
    new FileSink(jsonLogFile, !options.humanConsole);
    new HumanSink(humanLogFile, options.humanConsole);

    HumanSink.patchConsole();

    run(options.action, true);
    break;
  }
}

if (resultPromise !== null) {
  (async () => {
    const exitCode = await resultPromise;
    process.exit(exitCode);
  })();
}
