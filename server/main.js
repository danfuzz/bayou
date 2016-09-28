// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

var PORT = 9001;

var express = require('express');
var fs = require('fs');
var morgan = require('morgan');
var path = require('path');

var client_bundle = require('./client_bundle');
var log = require('./log');

/** Base dir of the product. */
var baseDir = path.resolve(__dirname, '..');

var app = express();

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
app.get('/static/bundle.js', client_bundle.requestHandler);

// Find HTML files and other static assets in `client/assets`. This includes the
// top-level `index.html` and `favicon`, as well as stuff under `static/`.
app.use('/', express.static(path.resolve(baseDir, 'client/assets')));

app.listen(PORT, function () {
  log(`Quillex listening on port ${PORT}.`);
});
