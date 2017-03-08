// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import express from 'express';
import express_ws from 'express-ws';
import fs from 'fs';
import path from 'path';

import { Context, PostConnection, WsConnection } from 'api-server';
import { ClientBundle } from 'client-bundle';
import { DocServer } from 'doc-server';
import { Hooks } from 'hooks-server';
import { SeeAll } from 'see-all';
import { Dirs } from 'server-env';

import Authorizer from './Authorizer';
import DebugTools from './DebugTools';
import RequestLogger from './RequestLogger';

/** Logger. */
const log = new SeeAll('app');

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
    /**
     * {DocServer} The one document we manage. **TODO:** Needs to be more than
     * one!
     */
    this._doc = new DocServer('some-id');

    /** {Context} All of the objects we provide access to via the API. */
    const context = this._context = new Context();
    context.add('auth', new Authorizer());
    context.add('main', this._doc);

    /** The underlying webserver run by this instance. */
    this._app = express();

    this._addRequestLogging();
    this._addRoutes();

    if (devMode) {
      this._addDevModeRoutes();
    }
  }

  /**
   * Starts up the server.
   */
  start() {
    const port = Hooks.listenPort;
    this._app.listen(port, () => {
      log.info(`Now listening on port ${port}.`);
    });
  }

  /**
   * Sets up logging for webserver requests.
   */
  _addRequestLogging() {
    // Stream to write to, when logging to a file.
    const accessStream = fs.createWriteStream(
      path.resolve(Dirs.VAR_DIR, 'access.log'),
      {flags: 'a'});

    RequestLogger.addLoggers(this._app, log.infoStream, accessStream);
  }

  /**
   * Sets up the webserver routes.
   */
  _addRoutes() {
    const app = this._app;

    // Make the webserver able to handle websockets.
    express_ws(app);

    // Map Quill files into `/static/quill`. This is used for CSS files but not for
    // the JS code; the JS code is included in the overall JS bundle file.
    app.use('/static/quill',
      express.static(path.resolve(Dirs.CLIENT_DIR, 'node_modules/quill/dist')));

    // Use Webpack to serve a JS bundle.
    app.get('/static/bundle.js', new ClientBundle().requestHandler);

    // Find HTML files and other static assets in `client/assets`. This includes the
    // top-level `index.html` and `favicon`, as well as stuff under `static/`.
    app.use('/', express.static(path.resolve(Dirs.CLIENT_DIR, 'assets')));

    // Use the `api-server` module to handle POST and websocket requests at
    // `/api`.
    app.post('/api',
      (req, res) => { new PostConnection(req, res, this._context); });
    app.ws('/api',
      (ws, req_unused) => { new WsConnection(ws, this._context); });
  }

  /**
   * Adds the dev mode routes.
   */
  _addDevModeRoutes() {
    const app = this._app;
    app.use('/debug', new DebugTools(this._doc).requestHandler);
  }
}
