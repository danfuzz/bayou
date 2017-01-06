// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import memory_fs from 'memory-fs';
import path from 'path';
import webpack from 'webpack';

import JsonUtil from 'json-util';
import SeeAll from 'see-all';
import ServerUtil from 'server-util';

import ProgressMessage from './ProgressMessage';

/** Logger. */
const log = new SeeAll('client-bundle');

/**
 * The parsed `package.json` for the client. This is used for some of the
 * `webpack` config.
 */
const clientPackage =
  JsonUtil.parseFrozen(
    fs.readFileSync(path.resolve(ServerUtil.CLIENT_DIR, 'package.json')));

/**
 * Options passed to the `webpack` compiler constructor. Of particular note,
 * we _do not_ try to restrict the loaders to any particular directories (e.g.
 * via `include` configs), instead _just_ applying them based on filename
 * extension. As such, any `.js` file will get loaded via our "modern ES"
 * pipeline, and any `.ts` file will get loaded via the TypeScript loader.
 */
const webpackOptions = {
  context: ServerUtil.CLIENT_CODE_DIR,
  debug: true,
  devtool: '#inline-source-map',
  entry: path.resolve(ServerUtil.CLIENT_DIR, clientPackage.main),
  output: {
    // Absolute output path of `/` because we write to a memory filesystem.
    path: '/',
    filename: 'bundle.js',
    publicPath: '/static/'
  },
  plugins: [
    new webpack.ProgressPlugin(new ProgressMessage(log).handler)
  ],
  resolve: {
    alias: {
      // The `quill` module as published exports an entry point which references
      // a prebuilt bundle. We rewrite it here to refer instead to the unbundled
      // source.
      'quill':
        path.resolve(ServerUtil.CLIENT_DIR, 'node_modules/quill/quill.js'),
      // Likewise, `parchment`.
      'parchment':
        path.resolve(ServerUtil.CLIENT_DIR, 'node_modules/parchment/src/parchment.ts'),
    },
    // All the extensions listed here except `.ts` are in the default list.
    // Webpack doesn't offer a way to simply add to the defaults (alas).
    extensions: ['', '.webpack.js', '.web.js', '.js', '.ts']
  },
  resolveLoader: {
    root: path.resolve(ServerUtil.SERVER_DIR, 'node_modules')
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
            return require.resolve(`babel-preset-${name}`);
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
            target: 'es5',
            // Parchment specifies this as `true`, but we need it to be `false`
            // because we _aren't_ building it as a standalone library.
            declaration: false
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
const watchOptions = {
  // Wait up to this many msec after detecting a changed file. This helps
  // prevent a rebuild from starting while in the middle of a file save.
  aggregateTimeout: 1000
};

/**
 * Wrapper around Webpack which can do both one-off builds as well as run
 * Webpack's "dev mode." Includes a request handler for hookup to Express.
 */
export default class ClientBundle {
  /**
   * Constructs an instance.
   */
  constructor() {
    /** Memory FS used to hold the immediate results of compilation. */
    this._fs = new memory_fs();

    /** Current (most recently built) compiled bundle. */
    this._currentBundle = null;

    /** Dev mode running? */
    this._devModeRunning = false;
  }

  /**
   * Returns a Webpack compiler instance, appropriately configured.
   *
   * @returns {webpack} Appropriately-configured instance.
   */
  _newCompiler() {
    const compiler = webpack(webpackOptions);

    // We use a `memory_fs` to hold the immediate results of compilation, to
    // make it possible to detect when things go awry before anything gets
    // stored to the real FS.
    compiler.outputFileSystem = this._fs;

    return compiler;
  }

  /**
   * Handles the results of running a compile. This gets called as a callback
   * from Webpack.
   *
   * @param {boolean} error `true` if there were errors running Webpack (which
   *   is _not_ the same as errors in source files being compiled).
   * @param {object} stats Detailed information about the compilation.
   */
  _handleCompilation(error, stats) {
    const warnings = stats.compilation.warnings;
    const errors = stats.compilation.errors;

    if (warnings && (warnings.length !== 0)) {
      log.warn('Compilation warnings.');
      for (let i = 0; i < warnings.length; i++) {
        const w = warnings[i];
        log.warn(w);
      }
    }

    if (error || (errors && (errors.length !== 0))) {
      log.error('Trouble compiling JS bundle.');
      for (let i = 0; i < errors.length; i++) {
        const e = errors[i];
        log.error(e.message);
      }
      return;
    }

    log.info('Compiled new JS bundle.');

    // Find the written bundle in the memory FS, read it, and then delete it.
    // See comments in `_newCompiler()`, above, for rationale.
    try {
      this._currentBundle = this._fs.readFileSync('/bundle.js');
      this._fs.unlinkSync('/bundle.js');
    } catch (e) {
      // File not found. This will happen when it turns out there were no
      // changes to the bundle. But it might happen in other cases too.
      log.info('Bundle not written! No changes?');
      return;
    }
  }

  /**
   * Handles a request for the JS bundle. This is suitable for use as an Express
   * handler function if bound to `this`.
   *
   * @param {object} req The HTTP request.
   * @param {object} res The HTTP response handler.
   */
  _requestHandler(req, res) {
    if (this._currentBundle) {
      res.type('application/javascript');
      res.send(this._currentBundle);
    } else {
      // This request came in before a bundle has ever been built. Instead of
      // trying to get too fancy, we just wait a second and retry (which itself
      // might end up waiting some more).
      setTimeout(this._requestHandler.bind(this), 1000, req, res);
    }
  }

  /**
   * Performs a single build. Returns the built artifact.
   *
   * @returns {Buffer} The built artifact.
   */
  build() {
    const compiler = this._newCompiler();
    compiler.run(this._handleCompilation.bind(this));
    return this._currentBundle;
  }

  /**
   * Starts up the Webpack dev mode system.
   */
  startWatching() {
    if (this._devModeRunning) {
      return;
    }

    const compiler = this._newCompiler();
    compiler.watch(watchOptions, this._handleCompilation.bind(this));
    this._devModeRunning = true;
  }

  /**
   * The request handler function, suitable for use with Express. Usable as-is
   * (without `.bind()`).
   */
  get requestHandler() {
    this.startWatching();
    return this._requestHandler.bind(this);
  }
}
