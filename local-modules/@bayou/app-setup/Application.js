// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import cookie from 'cookie';
import cookieParser from 'cookie-parser';
import express from 'express';
import http from 'http';
import path from 'path';
import ws from 'ws';

import { ContextInfo, PostConnection, WsConnection } from '@bayou/api-server';
import { Codecs, Urls } from '@bayou/app-common';
import { ClientBundle } from '@bayou/client-bundle';
import { Deployment, Network } from '@bayou/config-server';
import { DocServer } from '@bayou/doc-server';
import { Dirs, ServerEnv } from '@bayou/env-server';
import { Delay } from '@bayou/promise-util';
import { Logger } from '@bayou/see-all';
import { CommonBase, Errors, PropertyIterable } from '@bayou/util-common';

import { AppAuthorizer } from './AppAuthorizer';
import { DebugTools } from './DebugTools';
import { LoadFactor } from './LoadFactor';
import { Metrics } from './Metrics';
import { RequestLogger } from './RequestLogger';
import { RootAccess } from './RootAccess';
import { ServerUtil } from './ServerUtil';
import { TrafficSignal } from './TrafficSignal';
import { VarInfo } from './VarInfo';

/**
 * {Int} How long to wait (in msec) between iterations in
 * {@link #_closeConnections}.
 */
const CLOSE_CONNECTION_LOOP_DELAY_MSEC = 250; // 1/4 sec.

/**
 * {Int} How long to wait (in msec) between iterations in
 * {@link #_pollingUpdateLoop}.
 */
const POLLING_UPDATE_DELAY_MSEC = 60 * 1000; // One minute.

/** {Logger} Logger for this class. */
const log = new Logger('app');

/**
 * Web server for the application. This serves all application HTTP(S) requests,
 * including websocket requests.
 */
export class Application extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {boolean} devMode Whether or not to run in dev mode. If `true`, this
   *   activates `/debug/*` endpoints.
   */
  constructor(devMode) {
    super();

    /**
     * {ContextInfo} The common info used to construct {@link Context}
     * instances.
     */
    this._contextInfo = new ContextInfo(Codecs.fullCodec, new AppAuthorizer(this));

    /**
     * {object} The "root access" object. This is the object which tokens
     * bearing {@link Auth#TYPE_root} authority grant access to.
     */
    this._rootAccess = this._makeRootAccess();

    /** {LoadFactor} Load factor calculator. */
    this._loadFactor = new LoadFactor();

    /** {TrafficSignal} Traffic signal calculator. */
    this._trafficSignal = new TrafficSignal();

    /**
     * {Metrics} Metrics collector / reporter. This is what's responsible for
     * collecting info for reporting on the `/metrics` monitor endpoint.
     */
    this._metrics = new Metrics();

    /**
     * {VarInfo} The "variable info" handler. This is what's responsible for
     * producing the info sent back on the `/var` monitor endpoint.
     */
    this._varInfo = new VarInfo(this);

    /**
     * {Int} The port this application is actually listening on, or `0` if not
     * yet listening. This can be different from the configured `listenPort` in
     * testing scenarios.
     */
    this._listenPort = 0;

    /**
     * {Set<BaseConnection>} List of all currently active connections (or at
     * least active as of the most recent check for same).
     */
    this._connections = new Set();

    /** {Int} Count of connections that this server has ever had. */
    this._connectionCountTotal = 0;

    /**
     * {function} The top-level "Express application" run by this instance. It
     * is a request handler function which is suitable for use with Node's
     * `http` library.
     */
    this._app = express();

    /** {http.Server} The server that directly answers HTTP requests. */
    this._server = http.createServer(this._app);

    /** {RequestLogger} HTTP request / response logger. */
    this._requestLogger = new RequestLogger(log);

    this._addRoutes();
    this._addStaticRoutes();

    if (devMode) {
      this._addDevModeRoutes();
      log.event.addedDebugEndpoints();
    }

    this._pollingUpdateLoop(); // This (async) method runs forever.

    Object.seal(this);
  }

  /** {Int} Count of currently-active connections. */
  get connectionCountNow() {
    return this._connections.size;
  }

  /** {Int} Count of connections that this server has ever had. */
  get connectionCountTotal() {
    return this._connectionCountTotal;
  }

  /**
   * {Int} The port this application is actually listening on, or `0` if not
   * yet listening. This can be different from the configured `listenPort` in
   * testing scenarios.
   */
  get listenPort() {
    return this._listenPort;
  }

  /** {Int} The current load factor. */
  get loadFactor() {
    return this._loadFactor.value;
  }

  /**
   * {string} The loopback (local-access) base URL. This can have a different
   * port than the default configured `listenPort` in testing scenarios. It will
   * always match the {@link #listenPort} exposed by this instance.
   */
  get loopbackUrl() {
    return `http://localhost:${this.listenPort}`;
  }

  /** {Metrics} The associated metrics collector / reporter. */
  get metrics() {
    return this._metrics;
  }

  /**
   * {object} The "root access" object. This is the object which tokens bearing
   * {@link Auth#TYPE_root} authority grant access to.
   */
  get rootAccess() {
    return this._rootAccess;
  }

  /** {VarInfo} The "variable info" handler. */
  get varInfo() {
    return this._varInfo;
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
   * Indicates whether or not this instance is currently listening for
   * connections.
   *
   * @returns {boolean} `true` if this instance is listening for connections, or
   *   `false` if not.
   */
  isListening() {
    return this._server.listening;
  }

  /**
   * Gets the instantaneous-current traffic signal.
   *
   * @returns {boolean} Indication of whether (`true`) or not (`false`) traffic
   *   should currently be allowed.
   */
  async shouldAllowTraffic() {
    const signal  = this._trafficSignal;
    const healthy = await this.isHealthy();
    const now     = Date.now();

    signal.health(healthy);
    signal.loadFactor(this._loadFactor.value);
    return signal.shouldAllowTrafficAt(now);
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

    this._listenPort = await ServerUtil.listen(server, port);
    log.event.applicationPort(this._listenPort);

    if ((port !== 0) && (port !== this._listenPort)) {
      log.warn(`Originally requested port: ${port}`);
    }

    // **Note:** Both of these are `async` methods, but we don't actually want
    // to wait for them to return, because that'd be when the system is shutting
    // down!
    ServerUtil.handleSystemShutdown(server);
    this._handleSystemShutdown();

    return this._listenPort;
  }

  /**
   * Adds the dev mode routes.
   */
  _addDevModeRoutes() {
    const app = this._app;
    const debugTools = new DebugTools(this);
    app.use('/debug', debugTools.requestHandler);
  }

  /**
   * Sets up the main webserver routes.
   */
  _addRoutes() {
    const app = this._app;

    // Cookie parsing.
    app.use(cookieParser());

    // Logging and metrics.
    app.use(this._requestLogger.expressMiddleware);
    app.use(this._metrics.httpRequestMiddleware);

    // Thwack the `X-Powered-By` header that Express provides by default,
    // replacing it with something that identifies this product.
    app.use((req_unused, res, next) => {
      res.setHeader('X-Powered-By', ServerEnv.theOne.buildInfo.buildId);
      next();
    });

    // Use the `@bayou/api-server` module to handle POST requests at the API
    // endpoint, both with and without a trailing slash.

    const apiPathBase  = `/${Urls.API_PATH}`;                  // Base path.
    const apiPathRoute = `${apiPathBase}/:rest*`;              // Express route to handle subpaths.
    const apiPathRegex = new RegExp(`${apiPathBase}(?:/.*)?`); // Regexp to match base or subpaths.

    const postHandler = (req, res) => {
      try {
        const conn = new PostConnection(req, res, this._contextInfo);
        this._connections.add(conn);
        this._connectionCountTotal++;
      } catch (e) {
        log.error('Trouble with API request:', e);
      }
    };

    app.post(apiPathBase,  postHandler);
    app.post(apiPathRoute, postHandler);

    // Likewise, handle the same API endpoint URLs for websocket requests.
    // **Note:** The following (specifically, constructing `ws.Server` with the
    // `server` option) causes the websocket server instance to handle a
    // websocket request before Express has an opportunity to dispatch at all.
    // This means that no Express router logic will ever be run on a connection
    // that starts out with a websocket handshake.

    const wsVerify = (info, cb = null) => {
      const url = info.req.url;
      const ok  = apiPathRegex.test(url);

      // **Note:** The `ws` module docs indicate that it _sometimes_ calls the
      // verifier function with a `cb` argument. If it does, and if the main
      // result is `false`, it wants the `cb` to be passed additional arguments
      // to refine the error.
      if (cb !== null) {
        if (ok) {
          cb(true);
        } else {
          cb(false, 404, 'No websocket server at this endpoint.', {});
        }
      }

      return ok;
    };

    const wsServer = new ws.Server({
      server:       this._server,
      verifyClient: wsVerify
    });

    wsServer.on('connection', (wsSocket, req) => {
      try {
        const conn = new WsConnection(wsSocket, req, this._contextInfo);
        this._connections.add(conn);
        this._connectionCountTotal++;
      } catch (e) {
        log.error('Trouble with API websocket connection:', e);
      }
    });

    wsServer.on('headers', (headers, req) => {
      // The `ws` handler takes control before any of the middleware gets a
      // chance to run, so we have to "manually" do cookie parsing and request
      // logging here.
      if (req.headers.cookie) {
        req.cookies = cookie.parse(req.headers.cookie);
      }

      this._requestLogger.logWebsocketRequest(req, headers);
    });
  }

  /**
   * Sets up the static asset routes, including serving JS client code, but the
   * latter only if configured to do so. Notably, in a production configuration,
   * it is reasonably likely that code-serving routes should not be added.
   */
  _addStaticRoutes() {
    const app = this._app;

    if (Deployment.shouldServeClientCode()) {
      // Map Quill files into `/static/quill`. This is used for CSS files but
      // not for the JS code; the JS code is included in the overall JS bundle
      // file.
      app.use('/static/quill',
        express.static(path.resolve(Dirs.theOne.CLIENT_DIR, 'node_modules/quill/dist')));

      // Use the client bundler (which uses Webpack) to serve JS bundles. The
      // `:name` parameter gets interpreted by the client bundler to select
      // which bundle to serve.
      app.get('/static/js/:name.bundle.js', new ClientBundle().requestHandler);
    }

    // Use the configuration point to determine which directories to serve
    // HTML files and other static assets from. This includes (but is not
    // necessarily limited to) the top-level `index.html` and `favicon` files,
    // as well as stuff explicitly under `static/`.
    for (const dir of Deployment.ASSET_DIRS) {
      app.use('/', express.static(dir));
    }
  }

  /**
   * Tells all connections to close. Iterates until there seem to be no more
   * open connections.
   */
  async _closeConnections() {
    for (;;) {
      const open = [];

      for (const conn of this._connections) {
        if (conn.isOpen()) {
          open.push(conn);
        }
      }

      if (open.length === 0) {
        break;
      }

      const closePromises = open.map(conn => conn.close());
      await Promise.all(closePromises);

      log.event.closedConnections(open.length);

      await Delay.resolve(CLOSE_CONNECTION_LOOP_DELAY_MSEC);
    }

    log.event.allConnectionsClosed();
  }

  /**
   * Handles system shutdown by relaying the shutdown request to all active
   * connections.
   */
  async _handleSystemShutdown() {
    const shutdownManager = ServerEnv.theOne.shutdownManager;

    // This `await` returns soon after the system decides it is to shut down.
    await shutdownManager.whenShuttingDown();

    this._trafficSignal.shuttingDown();

    const allClosed = this._closeConnections();
    shutdownManager.waitFor(allClosed);
  }

  /**
   * Makes and returns the root access object, that is, the thing that gets
   * called to answer API calls on the root token(s).
   *
   * @returns {object} The root access object.
   */
  _makeRootAccess() {
    const basicRoot = new RootAccess();
    const extraRoot = Deployment.rootAccess();

    if (extraRoot === null) {
      return basicRoot;
    }

    // Smoosh the instance methods of `basicRoot` and `extraRoot` into an ad-hoc
    // plain object, with each method bound to the appropriate receiver.

    const result = {};

    for (const obj of [basicRoot, extraRoot]) {
      const skip = (obj instanceof CommonBase) ? CommonBase : Object;
      for (const desc of new PropertyIterable(obj).skipClass(skip).onlyPublicMethods()) {
        const name = desc.name;

        if (result[name] !== undefined) {
          throw Errors.badUse(`Duplicate root method: ${name}`);
        }

        result[name] = desc.value.bind(obj);
      }
    }

    return Object.freeze(result);
  }

  /**
   * Performs occasional polling of various bits of state, providing updates via
   * instance variables and metric call-outs. This method runs forever.
   Updates {@link #_connections} to reflect the currently-open state, running
   * forever and waiting a reasonable amount of time between updates.
   */
  async _pollingUpdateLoop() {
    for (;;) {
      await Delay.resolve(POLLING_UPDATE_DELAY_MSEC);

      try {
        this._updateConnections();
        await this._updateResourceConsumption();

        // **Note:** Both of the above have to be done before pushing out a load
        // factor update.
        const loadFactor = this._loadFactor.value;
        log.metric.loadFactor(loadFactor);
        this._metrics.loadFactor(loadFactor);
      } catch (e) {
        // Ignore the error (other than logging). We don't want trouble here to
        // turn into a catastrophic failure.
        log.event.errorInPollingUpdate(e);
      }
    }
  }

  /**
   * Helper for {@link #_pollingUpdateLoop}, which updates {@link #_connections}
   * and makes related metrics out-calls.
   */
  _updateConnections() {
    const connections = this._connections;

    for (const c of connections) {
      if (!c.isOpen()) {
        connections.delete(c);
      }
    }

    const countNow   = this.connectionCountNow;
    const countTotal = this.connectionCountTotal;

    this._loadFactor.activeConnections(countNow);
    log.metric.activeConnections(countNow);
    this._metrics.apiMetrics(countNow, countTotal);
  }

  /**
   * Helper for {@link #_pollingUpdateLoop}, which logs resource consumption
   * stats and uses them to update the load factor.
   */
  async _updateResourceConsumption() {
    const stats = await DocServer.theOne.currentResourceConsumption();

    this._loadFactor.docServerStats(stats);
    log.metric.totalResourceConsumption(stats);
  }
}
