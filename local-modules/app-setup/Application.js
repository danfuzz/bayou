// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import express from 'express';
import express_ws from 'express-ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import { ApiLog, BearerToken, Context, PostConnection, WsConnection } from 'api-server';
import { TheModule as appCommon_TheModule } from 'app-common';
import { ClientBundle } from 'client-bundle';
import { Dirs } from 'env-server';
import { Hooks } from 'hooks-server';
import { Logger } from 'see-all';

import DebugTools from './DebugTools';
import RequestLogger from './RequestLogger';
import RootAccess from './RootAccess';

/** Logger. */
const log = new Logger('app');

/**
 * Web server for the application. This serves all HTTP(S) requests, including
 * websocket requests.
 */
export default class Application {
  /**
   * Constructs an instance.
   *
   * @param {boolean} devMode Whether or not to run in dev mode. If `true`, this
   *   activates `/debug/*` endpoints.
   */
  constructor(devMode) {
    const codec = appCommon_TheModule.fullCodec;

    /**
     * {Context} All of the objects we provide access to via the API, along with
     * other objects of use to the server.
     */
    this._context = new Context(
      codec,
      new ApiLog(path.resolve(Dirs.theOne.LOG_DIR, 'api.log'), codec));
    this._context.startAutomaticIdleCleanup();

    /**
     * {array<BearerToken>} List of `BearerToken`s that are currently bound in
     * `context` which provide root access. This is updated in `_bindRoot()`.
     */
    this._rootTokens = Object.freeze([]);

    /**
     * {RootAccess} The "root access" object. This is the object which is
     * protected by the root bearer token(s) returned via the related
     * `hooks-server` hooks.
     */
    this._rootAccess = new RootAccess(this._context);

    // Bind `rootAccess` into the `context` using the root token(s), and arrange
    // for their update should the token(s) change.
    this._bindRoot();
    (async () => {
      for (;;) {
        await Hooks.theOne.bearerTokens.whenRootTokensChange();
        log.info('Root tokens updated.');
        this._bindRoot();
      }
    })();

    /**
     * {function} The top-level "Express application" run by this instance. It
     * is a request handler function which is suitable for use with Node's
     * `http` library.
     */
    this._app = express();

    /** {http.Server} The server that directly answers HTTP requests. */
    this._server = http.createServer(this._app);

    // Make the webserver able to handle websockets.
    express_ws(this._app, this._server);

    this._addRequestLogging();
    this._addRoutes();

    if (devMode) {
      this._addDevModeRoutes();
    }
  }

  /**
   * Starts up the server.
   *
   * @param {boolean} [pickPort = false] If `true`, causes the app to pick an
   *   arbitrary available port to listen on instead of the configured port.
   *   This is only meant to be passed as `true` in testing scenarios.
   * @returns {Int} The port being listened on, once listening has started.
   */
  async start(pickPort = false) {
    const port   = pickPort ? 0 : Hooks.theOne.listenPort;
    const server = this._server;

    await promisify(cb => server.listen(port, value => cb(null, value)))();

    const resultPort = server.address().port;

    log.info(`Listening on port: ${resultPort}.`);

    if ((port !== 0) && (port !== resultPort)) {
      log.warn(`Originally requested port: ${port}`);
    }

    return resultPort;
  }

  /**
   * Sets up logging for webserver requests.
   */
  _addRequestLogging() {
    // Stream to write to, when logging to a file.
    const accessStream = fs.createWriteStream(
      path.resolve(Dirs.theOne.LOG_DIR, 'access.log'),
      { flags: 'a' });

    RequestLogger.addLoggers(this._app, log.streamFor('info'), accessStream);
  }

  /**
   * Sets up the webserver routes.
   */
  _addRoutes() {
    const app = this._app;

    // Map Quill files into `/static/quill`. This is used for CSS files but not
    // for the JS code; the JS code is included in the overall JS bundle file.
    app.use('/static/quill',
      express.static(path.resolve(Dirs.theOne.CLIENT_DIR, 'node_modules/quill/dist')));

    // Use the client bundler (which uses Webpack) to serve JS bundles. The
    // `:name` parameter gets interpreted by the client bundler to select which
    // bundle to serve.
    app.get('/static/js/:name.bundle.js', new ClientBundle().requestHandler);

    // Find HTML files and other static assets in `client/assets`. This includes
    // the top-level `index.html` and `favicon`, as well as stuff under
    // `static/`.
    app.use('/', express.static(path.resolve(Dirs.theOne.CLIENT_DIR, 'assets')));

    // Use the `api-server` module to handle POST and websocket requests at
    // `/api`.
    app.post('/api',
      (req, res) => {
        try {
          new PostConnection(req, res, this._context);
        } catch (e) {
          log.error('Trouble with API request:', e);
        }
      });
    app.ws('/api',
      (ws, req) => {
        try {
          new WsConnection(ws, req, this._context);
        } catch (e) {
          log.error('Trouble with API request:', e);
        }
      });
  }

  /**
   * Adds the dev mode routes.
   */
  _addDevModeRoutes() {
    const app = this._app;
    const debugTools = new DebugTools(this._rootAccess);
    app.use('/debug', debugTools.requestHandler);
  }

  /**
   * Maintains up-to-date bindings for the `rootAccess` object, based on the
   * root token(s) reported via `hooks-server.bearerTokens`. This includes
   * a promise-chain-based ongoing update mechanism.
   */
  _bindRoot() {
    const context = this._context;
    const rootTokens = Hooks.theOne.bearerTokens.rootTokens;

    if (BearerToken.sameArrays(rootTokens, this._rootTokens)) {
      // No actual change. Note the fact.
      log.info('Root token update false alarm (no actual change).');
    } else {
      // Tokens have been updated (or this is the initial setup). So, remove the
      // old ones (if any) and add the new ones (if any).
      for (const t of this._rootTokens) {
        context.deleteId(t.id);
      }
      for (const t of rootTokens) {
        context.addEvergreen(t, this._rootAccess);
        log.info('Accept root:', t);
      }
      this._rootTokens = rootTokens;
    }
  }
}
