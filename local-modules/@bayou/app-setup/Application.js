// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import express from 'express';
import http from 'http';
import path from 'path';
import ws from 'ws';

import { BearerToken, Context, PostConnection, WsConnection } from '@bayou/api-server';
import { TheModule as appCommon_TheModule } from '@bayou/app-common';
import { ClientBundle } from '@bayou/client-bundle';
import { Deployment, Network } from '@bayou/config-server';
import { Dirs, ProductInfo } from '@bayou/env-server';
import { Logger } from '@bayou/see-all';
import { CommonBase } from '@bayou/util-common';

import DebugTools from './DebugTools';
import RequestLogger from './RequestLogger';
import RootAccess from './RootAccess';
import ServerUtil from './ServerUtil';

/** {Logger} Logger. */
const log = new Logger('app');

/**
 * Web server for the application. This serves all application HTTP(S) requests,
 * including websocket requests.
 */
export default class Application extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {boolean} devMode Whether or not to run in dev mode. If `true`, this
   *   activates `/debug/*` endpoints.
   */
  constructor(devMode) {
    super();

    const codec = appCommon_TheModule.fullCodec;

    /**
     * {Context} All of the objects we provide access to via the API, along with
     * other objects of use to the server.
     */
    this._context = new Context(codec);
    this._context.startAutomaticIdleCleanup();

    /**
     * {array<BearerToken>} List of `BearerToken`s that are currently bound in
     * `context` which provide root access. This is updated in `_bindRoot()`.
     */
    this._rootTokens = Object.freeze([]);

    /**
     * {RootAccess} The "root access" object. This is the object which is
     * protected by the root bearer token(s) returned via
     * {@link @bayou/config-server/Network#bearerTokens}.
     */
    this._rootAccess = new RootAccess(this._context);

    // Bind `rootAccess` into the `context` using the root token(s), and arrange
    // for their update should the token(s) change.
    this._bindRoot();
    (async () => {
      for (;;) {
        await Network.bearerTokens.whenRootTokensChange();
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

    /**
     * {string} Public ID of this server as reported through HTTP response
     * headers.
     */
    this._serverId = Application._makeIdString();

    /** {RequestLogger} HTTP request / response logger. */
    this._requestLogger = new RequestLogger(log);

    this._addRoutes();
    this._addStaticRoutes();

    if (devMode) {
      this._addDevModeRoutes();
      log.info('Enabled development / debugging endpoints.');
    }
  }

  /**
   * Indicates whether or not this instance currently considers itself
   * "healthy."
   *
   * @returns {boolean} `true` if this is a healthy instance, or `false` if not.
   */
  async isHealthy() {
    // **TODO:** Something useful.
    return true;
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
    const server     = this._server;
    const port       = pickPort ? 0 : Network.listenPort;
    const resultPort = await ServerUtil.listen(server, port);

    log.info(`Application server port: ${resultPort}`);

    if ((port !== 0) && (port !== resultPort)) {
      log.warn(`Originally requested port: ${port}`);
    }

    return resultPort;
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
   * Sets up the main webserver routes.
   */
  _addRoutes() {
    const app = this._app;

    // Logging.
    app.use(this._requestLogger.expressMiddleware);

    // Thwack the `X-Powered-By` header that Express provides by default,
    // replacing it with something that identifies this product.
    app.use((req_unused, res, next) => {
      res.setHeader('X-Powered-By', this._serverId);
      next();
    });

    // Use the `@bayou/api-server` module to handle POST and websocket requests
    // at `/api`.

    app.post('/api',
      (req, res) => {
        try {
          new PostConnection(req, res, this._context);
        } catch (e) {
          log.error('Trouble with API request:', e);
        }
      });

    // **Note:** The following causes the websocket server instance to capture
    // the request before Express has an opportunity to dispatch at all.
    const wsServer = new ws.Server({ server: this._server, path: '/api' });
    wsServer.on('connection', (wsSocket, req) => {
      try {
        new WsConnection(wsSocket, req, this._context);
      } catch (e) {
        log.error('Trouble with API websocket connection:', e);
      }

    });
    wsServer.on('headers', (headers, req) => {
      this._requestLogger.logWebsocketRequest(req, headers);
    });
  }

  /**
   * Sets up the static asset routes, including serving JS client code, but only
   * if configured to do so. Notably, in a production configuration, it is
   * reasonably likely that these routes should not be added.
   */
  _addStaticRoutes() {
    const app = this._app;

    // Map Quill files into `/static/quill`. This is used for CSS files but not
    // for the JS code; the JS code is included in the overall JS bundle file.
    app.use('/static/quill',
      express.static(path.resolve(Dirs.theOne.CLIENT_DIR, 'node_modules/quill/dist')));

    // Use the client bundler (which uses Webpack) to serve JS bundles. The
    // `:name` parameter gets interpreted by the client bundler to select which
    // bundle to serve.
    app.get('/static/js/:name.bundle.js', new ClientBundle().requestHandler);

    // Use the configuration point to determine which directories to serve
    // HTML files and other static assets from. This includes (but is not
    // necessarily limited to) the top-level `index.html` and `favicon` files,
    // as well as stuff explicitly under `static/`.
    for (const dir of Deployment.ASSET_DIRS) {
      app.use('/', express.static(dir));
    }
  }

  /**
   * Maintains up-to-date bindings for the `rootAccess` object, based on the
   * root token(s) reported via
   * {@link @bayou/config-server/Network#bearerTokens}. This includes a
   * promise-chain-based ongoing update mechanism.
   */
  _bindRoot() {
    const context = this._context;
    const rootTokens = Network.bearerTokens.rootTokens;

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

  /**
   * Makes the server ID string to report in HTTP responses.
   *
   * @returns {string} The server ID string.
   */
  static _makeIdString() {
    const { name, version, commit_id } = ProductInfo.theOne.INFO;

    const id = ((typeof commit_id === 'string') && commit_id !== '')
      ? `-${commit_id.slice(0, 8)}`
      : '';

    return `${name}-${version}${id}`;
  }
}
