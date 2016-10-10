// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/*
 * Request handler which builds and serves the bundled JS. It's set up for the
 * usual live-development style: It builds the bundle once upon startup and then
 * automatically rebuilds whenever any of the files change.
 */

import fs from 'fs';
import memory_fs from 'memory-fs';
import path from 'path';
import webpack from 'webpack';

import log from './log';

/** Base directory of the product. */
var baseDir = path.resolve(__dirname, '..');

/** Client code directory. */
var clientDir = path.resolve(baseDir, 'client');

/** Where to find all our non-module JS files. */
var jsDir = path.resolve(clientDir, 'js');

/**
 * The parsed `package.json` for the client. This is used for some of the
 * `webpack` config.
 */
var clientPackage =
  JSON.parse(fs.readFileSync(path.resolve(clientDir, 'package.json')));

/**
 * Options passed to the `webpack` compiler constructor. Of particular note,
 * we _do not_ try to restrict the loaders to any particular directories (e.g.
 * via `include` configs), instead _just_ applying them based on filename
 * extension. As such, any `.js` file will get loaded via our "modern ES"
 * pipeline, and any `.ts` file will get loaded via the TypeScript loader.
 */
var webpackOptions = {
  context: jsDir,
  debug: true,
  devtool: '#inline-source-map',
  entry: path.resolve(clientDir, clientPackage.main),
  output: {
    // Absolute output path of `/` because we write to a memory filesystem.
    path: '/',
    filename: 'bundle.js',
    publicPath: '/static/'
  },
  plugins: [
    new webpack.ProgressPlugin(progressMessage)
  ],
  resolve: {
    alias: {
      // The `quill` module as published exports an entry point which references
      // a prebuilt bundle. We rewrite it here to refer instead to the unbundled
      // source.
      'quill': path.resolve(clientDir, 'node_modules/quill/quill.js'),
      // Likewise, `parchment`.
      'parchment': path.resolve(clientDir, 'node_modules/parchment/src/parchment.ts'),
    },
    // All the extensions listed here except `.ts` are in the default list.
    // Webpack doesn't offer a way to simply add to the defaults (alas).
    extensions: ['', '.webpack.js', '.web.js', '.js', '.ts']
  },
  resolveLoader: {
    root: path.resolve(baseDir, 'server/node_modules')
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        query: {
          // Babel doesn't respect the `resolveLoader.root` value. Because we
          // treat the `client` and `server` as peers (that is, because the
          // server modules aren't in a super-directory of `client`), we have to
          // "manually" resolve the presets. See
          // <https://github.com/babel/babel-loader/issues/149>,
          // <https://github.com/babel/babel-loader/issues/166>, and
          // <http://stackoverflow.com/questions/34574403/how-to-set-resolve-for-babel-loader-presets/>
          // for details and discussion.
          presets: ['es2015', 'es2016', 'es2017'].map(function (name) {
            return require.resolve('babel-preset-' + name);
          }),
        }
      },
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        query: {
          compilerOptions: {
            // A reasonably conservative choice, and also recapitulates what
            // Quill's Webpack config does.
            target: 'es5'
          },
          silent: true, // Avoids the banner spew.
          transpileOnly: true
        }
      },
      // Quill uses `require()` to access `.svg` assets. The configuration here
      // recapitulates how Quill is set up to process those assets. See
      // <https://github.com/quilljs/quill/blob/develop/_develop/webpack.config.js>.
      {
        test: /\.svg$/,
        loader: 'html-loader',
        query: {
          minimize: true
        }
      }
    ]
  }
};

/** Options passed to `compiler.watch()`. */
var watchOptions = {
  // Wait up to this many msec after detecting a changed file. This helps
  // prevent a rebuild from starting while in the middle of a file save.
  aggregateTimeout: 1000
};

/**
 * The latest compiled bundle. This gets set by the `watch()` callback, which
 * fires off after each build completes.
 */
var latestBundle = null;

/**
 * Timestamp of the most recent progress message. Used to limit frequency of
 * messages so as not to spew too much.
 */
var lastProgressMessageTime = 0;

// Replace `false` with `true` here to add a delay to the first compilation, and
// thereby make it easier to test startup.
if (false) {
  // Wait ten seconds, and then start the compile-watch loop.
  setTimeout(compileAndWatch, 10 * 1000);
} else {
  compileAndWatch();
}

/**
 * Starts up the compile-and-watch loop. This is in a function (and not just
 * called directly) to make it easier to test the startup condition of a
 * request before the first compile finishes.
 */
function compileAndWatch() {
  var fs = new memory_fs();
  var compiler = webpack(webpackOptions);
  compiler.outputFileSystem = fs;

  compiler.watch(watchOptions, function (err, stats) {
    var warnings = stats.compilation.warnings;
    var errors = stats.compilation.errors;

    if (warnings && (warnings.length !== 0)) {
      log('Compilation warnings.')
      for (var i = 0; i < warnings.length; i++) {
        var w = warnings[i];
        log(w);
      }
    }

    if (err || (errors && (errors.length !== 0))) {
      log('Trouble compiling JS bundle.')
      for (var i = 0; i < errors.length; i++) {
        var e = errors[i];
        log(e.message);
      }
      return;
    }

    log('Compiled new JS bundle.');
    try {
      latestBundle = fs.readFileSync('/bundle.js');
    } catch (e) {
      // File not found; something went wacky!
      log('Bundle not written!');
    }
  });
}

/**
 * Handles a progress message. Emits the message along with the percentage, but
 * only if (a) this is a message for the start or end of a task (0% or 100%),
 * or (b) the last progress message wasn't too recent.
 */
function progressMessage(frac, msg) {
  var now = Date.now();
  if ((frac > 0.0001) && (frac < 0.9999)) {
    // Not the start or end; check the timestamp. If it's within 1 second
    // (1000 msec), ignore it.
    if (now < (lastProgressMessageTime + 1000)) {
      return;
    }
  }

  if (msg === '') {
    if (frac >= 0.9999) {
      msg = 'done';
    } else {
      msg = 'still working';
    }
  }

  lastProgressMessageTime = now;
  log(Math.floor(frac * 100) + '% -- ' + msg);
}

export default class ClientBundle {
  /**
   * Handles a request for the JS bundle. This is suitable for use as an Express
   * handler function.
   */
  static requestHandler(req, res) {
    if (latestBundle) {
      res.type('application/javascript');
      res.send(latestBundle);
    } else {
      // This request came in before a bundle has ever been built. Instead of
      // trying to get too fancy, we just wait a second and retry (which itself
      // might end up waiting some more).
      setTimeout(ClientBundle.requestHandler, 1000, req, res);
    }
  }
}
