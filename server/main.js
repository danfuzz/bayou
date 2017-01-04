// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// This `import` patches Node's backtrace handler so as to make it respect
// source maps (and so produce traces with proper source position info for
// compiled files). We do this as the very first thing upon running, so that
// any exceptions thrown during bootstrap have a reasonable chance of getting
// displayed with an accurate backtrace.
import 'source-map-support/register';

import DocServer from 'doc-server';
import SeeAllServer from 'see-all-server';
import ServerUtil from 'server-util';

import AppServer from './AppServer';
import DevMode from './DevMode';

// Initialize logging.
SeeAllServer.init();

// Set up the PID file handler.
ServerUtil.initPidFile();

/** Dev mode? */
const devMode = (process.argv[2] === '--dev');

if (devMode) {
  // We're in dev mode. This starts the system that live-syncs the client
  // source.
  new DevMode().start();
}

/** The single document managed by this instance. */
const theDoc = new DocServer();

/** The main app server. */
const theApp = new AppServer(theDoc, devMode);

// Start the app!
theApp.start();
