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
import { SeeAll } from 'see-all';
import { FileLogger, SeeAllServer } from 'see-all-server';
import { Dirs, ProductInfo, ServerEnv } from 'server-env';


/** Logger for this file. */
const log = new SeeAll('main');

/** Error during argument processing? */
let argError = false;

/**
 * Parsed command-line options. **Note:** The `slice` gets rid of the `node`
 * binary name and the name of the initial script (that is, this file).
 */
const opts = minimist(process.argv.slice(2), {
  boolean: ['client-bundle', 'dev', 'help'],
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

/** Want help? */
const showHelp = opts['help'];

if (devMode && clientBundleMode) {
  // eslint-disable-next-line no-console
  console.log('Cannot specify both `--dev` and `--client-bundle`.');
  argError = true;
}

if (showHelp || argError) {
  const progName = opts['prog-name'] || path.basename(process.argv[1]);
  [
    'Usage:',
    '',
    `${progName} [--dev | --client-bundle]`,
    '  Run the project.',
    '',
    '  --client-bundle',
    '    Just build a client bundle, and report any errors encountered.',
    '  --dev',
    '    Run in development mode, for interactive development without having',
    '    to restart.',
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

// Initialize logging.
SeeAllServer.init();
new FileLogger(path.resolve(Dirs.VAR_DIR, 'general.log'));

if (clientBundleMode) {
  clientBundle();
} else {
  run();
}
