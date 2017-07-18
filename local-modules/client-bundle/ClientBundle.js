// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import memory_fs from 'memory-fs';
import path from 'path';
import webpack from 'webpack';

import { Logger } from 'see-all';
import { Dirs } from 'server-env';
import { JsonUtil, Singleton } from 'util-common';

import ProgressMessage from './ProgressMessage';

/** Logger. */
const log = new Logger('client-bundle');

/**
 * The parsed `package.json` for the client. This is used for some of the
 * `webpack` config.
 */
const clientPackage =
  JsonUtil.parseFrozen(
    fs.readFileSync(path.resolve(Dirs.theOne.CLIENT_DIR, 'package.json')));

/**
 * Options passed to the `webpack` compiler constructor. Of particular note,
 * we _do not_ try to restrict the loaders to any particular directories (e.g.
 * via `include` configs), instead _just_ applying them based on filename
 * extension. As such, any `.js` file will get loaded via our "modern ES"
 * pipeline, and any `.ts` file will get loaded via the TypeScript loader.
 *
 * **Note** about `require.resolve()` as used below: Babel doesn't respect the
 * Webpack `context` option. Because we treat the `client` and `server` as
 * peers (that is, because the server modules aren't in a super-directory of
 * `client`), we have to "manually" resolve the presets. See
 * <https://github.com/babel/babel-loader/issues/149>,
 * <https://github.com/babel/babel-loader/issues/166>, and
 * <http://stackoverflow.com/questions/34574403/how-to-set-resolve-for-babel-loader-presets/>
 * for details and discussion.
 */
const webpackOptions = {
  context: Dirs.theOne.SERVER_DIR, // Used for resolving loaders and the like.
  devtool: '#inline-source-map',
  entry: {
    main: [
      'babel-polyfill',
      path.resolve(Dirs.theOne.CLIENT_DIR, clientPackage.main)
    ],
    test: [
      'babel-polyfill',
      path.resolve(Dirs.theOne.CLIENT_DIR, clientPackage.testMain)
    ]
  },
  output: {
    // Absolute output path of `/` because we write to a memory filesystem.
    // And no `.js` suffix, because the memory filesystem contents aren't
    // served out directly but just serve as an intermediate waystation. See
    // `_handleCompilation()` for more details.
    path: '/',
    filename: '[name]',
    publicPath: '/static/js/'
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
        path.resolve(Dirs.theOne.CLIENT_DIR, 'node_modules/quill/quill.js'),

      // Likewise, `parchment`.
      'parchment':
        path.resolve(Dirs.theOne.CLIENT_DIR, 'node_modules/parchment/src/parchment.ts'),

      // On the client side, we use a built-in module called `test-all` as a
      // substitute for `mocha`. This alias makes it so that testing code can
      // still write `import ... from 'mocha';`.
      'mocha':
        path.resolve(Dirs.theOne.CLIENT_DIR, 'node_modules/test-all')
    },
    // All the extensions listed here except `.ts` are in the default list.
    // Webpack doesn't offer a way to simply add to the defaults (alas).
    extensions: ['.webpack.js', '.web.js', '.js', '.ts']
  },
  module: {
    rules: [
      {
        // The bulk of this project's code is written in modern JavaScript.
        test: /\.js$/,

        // `chai` uses the arguably-deprecated `arguments.callee` construct, so
        // it would fail if we ran it through this conversion. We exclude it
        // here, which means that its code gets passed through (basically)
        // as-is. **TODO:** Chai has addressed this in v4.0, which as of this
        // writing is in alpha (or maybe beta). Once it's done for real, we can
        // update the dependency and remove this `exclude` clause.
        //
        // **Note:** At some point, we might want to reverse the polarity and
        // say that we only use Babel on (a) our own modules, and (b) Quill
        // (which definitely requires it as it's written using modern syntax).
        exclude: [
          /\/node_modules\/chai\//
        ],

        use: [{
          loader: 'babel-loader',
          options: {
            presets: [
              [
                require.resolve('babel-preset-env'),
                {
                  targets: {
                    browsers: [
                      // See <https://github.com/ai/browserslist> for syntax.
                      'Chrome >= 59',
                      'ChromeAndroid >= 59',
                      'Electron >= 1.7',
                      'Firefox >= 54',
                      'iOS >= 10',
                      'Safari >= 10.1'
                    ]
                  }
                }
              ]
            ]
          }
        }]
      },
      {
        // Parchment (a dependency of Quill) is written in TypeScript.
        test: /\.ts$/,
        use: [{
          loader: 'ts-loader',
          options: {
            compilerOptions: {
              // A reasonably conservative choice, and also recapitulates what
              // Parchment's `tsconfig.json` specifies.
              target: 'es5',
              // Parchment specifies this as `true`, but we need it to be
              // `false` because we _aren't_ building it as a standalone
              // library.
              declaration: false
            },
            silent: true, // Avoids the banner spew.
            transpileOnly: true
          }
        }]
      },
      {
        // Quill uses `require()` to access `.svg` assets. The configuration
        // here recapitulates how Quill is set up to process those assets. See
        // <https://github.com/quilljs/quill/blob/develop/_develop/webpack.config.js>.
        test: /\.svg$/,
        use: [{
          loader: 'html-loader',
          options: {
            minimize: true
          }
        }]
      },
      {
        // This handles dynamic construction of the main test-collector file.
        test: /\/client-tests$/,
        use: [{
          loader: 'client-tests-loader'
        }]
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
export default class ClientBundle extends Singleton {
  /**
   * Constructs the instance.
   */
  constructor() {
    super();

    /**
     * {memory_fs} Memory FS used to hold the immediate results of compilation.
     */
    this._fs = new memory_fs();

    /** {Map<string,Buffer>} Current (most recently built) compiled bundles. */
    this._currentBundles = new Map();

    /** {boolean} Dev mode running? */
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
    // cached or (heaven forfend) sent out over the network. Once a compilation
    // is successful, we grab the result into `_currentBundles` and erase it
    // from the memory FS.
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

    // Find the written bundles in the memory FS, reading and deleting each.
    // See comments in `_newCompiler()`, above, for rationale.
    const allFiles = this._fs.readdirSync('/');
    let any = false;
    for (const name of allFiles) {
      // The `test()` skips `.` and `..`.
      if (/^[a-z]/.test(name)) {
        const fullPath = `/${name}`;
        log.info(`Bundle updated: ${name}`);
        this._currentBundles.set(name, this._fs.readFileSync(fullPath));
        this._fs.unlinkSync(fullPath);
        any = true;
      }
    }

    if (!any) {
      // No bundles found. This will happen when it turns out there were no
      // code changes _or_ when there was a bona fide error. In the latter
      // case, though, we would have caught and reported it before we got here.
      log.info('No bundles updated (code was unchanged).');
    }
  }

  /**
   * Handles a request for the JS bundle. This is suitable for use as an Express
   * handler function if bound to `this`.
   *
   * @param {object} req The HTTP request.
   * @param {object} res The HTTP response handler.
   * @param {function} next Function to call to execute the next handler in the
   *   chain.
   */
  _requestHandler(req, res, next) {
    const bundles = this._currentBundles;

    if (bundles.size === 0) {
      // This request came in before bundles have ever been built. Instead of
      // trying to get too fancy, we just wait a second and retry (which itself
      // might end up waiting some more).
      setTimeout(() => { this._requestHandler(req, res, next); }, 1000);
      return;
    }

    const name = req.params.name;
    const bundle = bundles.get(name);

    if (bundle) {
      res.type('application/javascript');
      res.send(bundle);
    } else {
      // No such bundle (as opposed to merely not having been built yet, which
      // would have been caught above). We use the `next()` handler, which
      // should bottom out in an HTTP(S) failure.
      next();
    }
  }

  /**
   * Performs a single build. Returns a promise for the built artifacts.
   *
   * @returns {Promise<Map<string,Buffer>>} The built artifacts.
   */
  build() {
    const result = new Promise((res, rej) => {
      const compiler = this._newCompiler();
      compiler.run((error, stats) => {
        this._handleCompilation(error, stats);
        if (this._currentBundles) {
          res(this._currentBundles);
        } else {
          rej('Trouble building client bundles.');
        }
      });
    });

    return result;
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
