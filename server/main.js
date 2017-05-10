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

import minimist from 'minimist';

import { Application } from 'app-setup';
import { ClientBundle } from 'client-bundle';
import { DevMode } from 'dev-mode';
import { Hooks } from 'hooks-server';
import { Logger } from 'see-all';
import { FileSink, ServerSink } from 'see-all-server';
import { Dirs, ProductInfo, ServerEnv } from 'server-env';
import { ServerTests } from 'testing-server';


/** Logger for this file. */
const log = new Logger('main');

/** Error during argument processing? */
let argError = false;

/**
 * Parsed command-line options. **Note:** The `slice` gets rid of the `node`
 * binary name and the name of the initial script (that is, this file).
 */
const opts = minimist(process.argv.slice(2), {
  boolean: ['client-bundle', 'dev', 'help', 'server-test'],
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

/** Client bundle build mode? */
const clientBundleMode = opts['client-bundle'];

/** Dev mode? */
const devMode = opts['dev'];

/** Server test mode? */
const serverTestMode = opts['server-test'];

/** Want help? */
const showHelp = opts['help'];

if ((clientBundleMode + devMode + serverTestMode) > 1) {
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
 */
function run() {
  // Set up the server environment bits (including, e.g. the PID file).
  ServerEnv.init();

  // A little spew to identify us.
  const info = ProductInfo.INFO;
  for (const k of Object.keys(info)) {
    log.info(`${k} = ${info[k]}`);
  }

  if (devMode) {
    // We're in dev mode. This starts the system that live-syncs the client
    // source.
    new DevMode().start();
  }

  Hooks.run();

  /** The main app server. */
  const theApp = new Application(devMode);

  // Start the app!
  theApp.start();
}

/**
 * Does a client bundling.
 */
function clientBundle() {
  new ClientBundle().build().then((res_unused) => {
    process.exit(0);
  }, (rej) => {
    log.error(rej);
    process.exit(1);
  });
}

/**
 * Does a server testing run.
 */
function serverTest() {
  // TODO: Arguably this call shouldn't be necessary. (That is, the test code
  // that cares about server env stuff should arrange for its appropriate
  // initialization and perhaps even teardown.)
  ServerEnv.init();

  ServerTests.runAll((failures) => {
    const anyFailed = (failures !== 0);
    const msg = anyFailed
      ? `Failed: ${failures}`
      : 'All good! Yay!';

    console.log(msg); // eslint-disable-line no-console
    process.exit(anyFailed ? 1 : 0);
  });
}

// Initialize logging.
ServerSink.init();
new FileSink(path.resolve(Dirs.LOG_DIR, 'general.log'));

if (clientBundleMode) {
  clientBundle();
} else if (serverTestMode) {
  serverTest();
} else {
  run();
}
