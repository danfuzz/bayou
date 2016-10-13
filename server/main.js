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

import ApiServer from './ApiServer';
import ClientBundle from './ClientBundle';
import DevMode from './DevMode';
import log from './log';

/** What port to listen for connections on. */
var PORT = 8080;

/** Base dir of the product. */
var baseDir = path.resolve(__dirname, '..');

// Are we in dev mode? If so, we aim to live-sync the original source.
if (process.argv[2] === '--dev') {
  DevMode.start();
}

var app = express();
express_ws(app);

// An abbreviated and colorized log to the console.
app.use(morgan('dev'));

// A fairly complete log written to a file.
var logStream = fs.createWriteStream(path.resolve(baseDir, 'access.log'), {flags: 'a'});
app.use(morgan('common', {stream: logStream}));

// Map Quill files into `/static/quill`. This is used for CSS files but not for
// the JS code; the JS code is included in the overall JS bundle file.
app.use('/static/quill',
  express.static(path.resolve(baseDir, 'client/node_modules/quill/dist')));

// Use Webpack to serve a JS bundle.
app.get('/static/bundle.js', ClientBundle.requestHandler);

// Find HTML files and other static assets in `client/assets`. This includes the
// top-level `index.html` and `favicon`, as well as stuff under `static/`.
app.use('/', express.static(path.resolve(baseDir, 'client/assets')));

// Attach the API server.
app.ws('/api', (ws, req) => { new ApiServer(ws); });

app.listen(PORT, function () {
  log(`Quillex listening on port ${PORT}.`);
});
