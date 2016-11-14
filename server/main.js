// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// This `import` patches Node's backtrace handler so as to make it respect
// source maps (and so produce traces with proper source position info for
// compiled files). We do this as the very first thing upon running, so that
// any exceptions thrown during bootstrap have a reasonable chance of getting
// displayed with an accurate backtrace.
import 'source-map-support/register';

import express from 'express';
import express_ws from 'express-ws';
import fs from 'fs';
import morgan from 'morgan';
import path from 'path';
import process from 'process';

import SeeAll from 'see-all';
import LogServer from 'see-all/LogServer';

import ApiServer from './ApiServer';
import ClientBundle from './ClientBundle';
import DebugTools from './DebugTools';
import DevMode from './DevMode';
import Document from './Document';

/** Logger. */
const log = new SeeAll('main');
SeeAll.init(LogServer);

/** What port to listen for connections on. */
const PORT = 8080;

/** Base dir of the product. */
const baseDir = path.resolve(__dirname, '..');

/** Dev mode? */
const DEV_MODE = (process.argv[2] === '--dev');

if (DEV_MODE) {
  // We're in dev mode. This starts the system that live-syncs the client source.
  new DevMode().start();
}

/** The single document managed by this instance. */
const theDoc = new Document();

/** The single webserver run by this instance. */
const app = express();

addRequestLogging();
addRoutes();

app.listen(PORT, function () {
  log.info(`Quillex listening on port ${PORT}.`);
});

/**
 * Sets up logging for webserver requests.
 */
function addRequestLogging() {
  // Stream to write to, when logging to a file.
  const logStream =
    fs.createWriteStream(path.resolve(baseDir, 'access.log'), {flags: 'a'});

  // These log regular (non-websocket) requests at the time of completion,
  // including a short colorized form to the console and a longer form to a
  // file.

  app.use(morgan('dev', {
    stream: log.infoStream
  }));

  app.use(morgan('common', {
    stream: logStream
  }));

  // These log websocket requests, at the time of request start (not at the
  // time of completion because these are long-lived requests).

  // Log skip function: Returns `true` for anything other than a websocket
  // request.
  function skip(req, res) {
    return (req.get('upgrade') !== 'websocket');
  }

  app.use(morgan('WS :url', {
    stream:    log.infoStream,
    immediate: true,
    skip:      skip
  }));

  app.use(morgan('common', {
    stream:    logStream,
    immediate: true,
    skip:      skip
  }));
}

/**
 * Sets up the webserver routes.
 */
function addRoutes() {
  // Make the webserver able to handle websockets.
  express_ws(app);

  // Map Quill files into `/static/quill`. This is used for CSS files but not for
  // the JS code; the JS code is included in the overall JS bundle file.
  app.use('/static/quill',
    express.static(path.resolve(baseDir, 'client/node_modules/quill/dist')));

  // Use Webpack to serve a JS bundle.
  app.get('/static/bundle.js', new ClientBundle().requestHandler);

  // Find HTML files and other static assets in `client/assets`. This includes the
  // top-level `index.html` and `favicon`, as well as stuff under `static/`.
  app.use('/', express.static(path.resolve(baseDir, 'client/assets')));

  // Attach the API server.
  app.ws('/api', (ws, req) => { new ApiServer(ws, theDoc); });

  if (DEV_MODE) {
    // Add a handler for the debug tools.
    app.use('/debug', new DebugTools(theDoc).requestHandler);
  }
}
