// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import memory_fs from 'memory-fs';
import webpack from 'webpack';

import { Delay } from '@bayou/promise-util';
import { Singleton } from '@bayou/util-common';

import { WebpackConfig } from './WebpackConfig';

/**
 * Wrapper around Webpack which can do both one-off builds as well as run
 * Webpack's "dev mode." Includes a request handler for hookup to Express.
 */
export class ClientBundle extends Singleton {
  /**
   * Constructs the instance.
   */
  constructor() {
    super();

    /** {WebpackConfig} Configuration object. */
    this._config = WebpackConfig.theOne;

    /** {Logger} Logger to use for this module. */
    this._log = this._config.log;

    /**
     * {memory_fs} Memory FS used to hold the immediate results of compilation.
     */
    this._fs = new memory_fs();

    /** {Map<string, Buffer>} Current (most recently built) compiled bundles. */
    this._currentBundles = new Map();

    /** {boolean} Dev mode running? */
    this._devModeRunning = false;

    /**
     * {Int} How many times have we seen Webpack run with a result of no
     * compiled code changing. This count is used to drive a bit of informative
     * logging.
     */
    this._nothingChanged = 0;
  }

  /**
   * Returns a Webpack compiler instance, appropriately configured.
   *
   * @returns {webpack} Appropriately-configured instance.
   */
  _newCompiler() {
    const compiler = webpack(WebpackConfig.theOne.webpackConfig);

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
    // So the progress message doesn't get stuck at 100%.
    this._config.progress.reset();

    const log      = this._log;
    const warnings = stats.compilation.warnings;
    const errors   = stats.compilation.errors;

    if (warnings && (warnings.length !== 0)) {
      log.warn('Compilation warnings.');
      for (let i = 0; i < warnings.length; i++) {
        const w = warnings[i];
        log.warn(w);
      }
    }

    if (error || (errors && (errors.length !== 0))) {
      log.error('Trouble compiling JS bundles.');
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
        log.event.bundleUpdated(name);
        this._currentBundles.set(name, this._fs.readFileSync(fullPath));
        this._fs.unlinkSync(fullPath);
        any = true;
      }
    }

    if (any) {
      this._nothingChanged = 0;
    } else {
      // No bundles found. This will happen when it turns out there were no
      // code changes _or_ when there was a bona fide error. In the latter
      // case, though, we would have caught and reported it before we got here.
      this._nothingChanged++;
      if (this._nothingChanged < 5) {
        log.info('No bundles updated (code was unchanged).');
      } else if (this._nothingChanged === 5) {
        log.info(
          'No bundles updated. This is probably happening because your\n' +
          'virus checker is fooling Webpack into rereading source files.');
      } else {
        log.info('No bundles updated. Probably more virus checker churn.');
      }
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
  async _requestHandler(req, res, next) {
    const bundles = this._currentBundles;

    if (bundles.size === 0) {
      // This request came in before bundles have ever been built, but we know
      // by virtue of being here that they are in the process of being built.
      // Instead of trying to get too fancy, we just wait a second and recheck
      // (and maybe recheck yet again, etc.).
      this._log.event.waitingForBundles();
      while (bundles.size === 0) {
        await Delay.resolve(1000);
      }
      this._log.event.doneWaitingForBundles();
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
    const result = new Promise((resolve, reject) => {
      const compiler = this._newCompiler();
      compiler.run((error, stats) => {
        this._handleCompilation(error, stats);
        if (this._currentBundles.size !== 0) {
          resolve(this._currentBundles);
        } else {
          reject('Trouble building client bundles.');
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
    compiler.watch(
      WebpackConfig.theOne.watchConfig, this._handleCompilation.bind(this));
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
