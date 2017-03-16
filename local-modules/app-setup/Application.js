// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import express from 'express';
import express_ws from 'express-ws';
import fs from 'fs';
import path from 'path';

import { BearerToken, Context, PostConnection, WsConnection } from 'api-server';
import { ClientBundle } from 'client-bundle';
import { DocForAuthor, DocServer } from 'doc-server';
import { Hooks } from 'hooks-server';
import { SeeAll } from 'see-all';
import { Dirs } from 'server-env';

import DebugTools from './DebugTools';
import RequestLogger from './RequestLogger';
import RootAccess from './RootAccess';

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
    /** {Context} All of the objects we provide access to via the API. */
    const context = this._context = new Context();

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
    const rootAccess = this._rootAccess = new RootAccess(context);

    // Bind `rootAccess` into the `context` using the root token(s), and arrange
    // for their update should the token(s) change.
    this._bindRoot();

    // Legacy binding. TODO: Project-external code should stop using this.
    context.add('auth', rootAccess.legacyAuth);


    /**
     * {DocForAuthor} The one document we manage. **TODO:** Needs to be more
     * than one!
     */
    this._doc = new DocForAuthor(
      DocServer.THE_INSTANCE.getDoc('some-id'), 'some-author');
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
      { flags: 'a' });

    RequestLogger.addLoggers(this._app, log.infoStream, accessStream);
  }

  /**
   * Sets up the webserver routes.
   */
  _addRoutes() {
    const app = this._app;

    // Make the webserver able to handle websockets.
    express_ws(app);

    // Map Quill files into `/static/quill`. This is used for CSS files but not
    // for the JS code; the JS code is included in the overall JS bundle file.
    app.use('/static/quill',
      express.static(path.resolve(Dirs.CLIENT_DIR, 'node_modules/quill/dist')));

    // Use Webpack to serve a JS bundle.
    app.get('/static/bundle.js', new ClientBundle().requestHandler);

    // Find HTML files and other static assets in `client/assets`. This includes
    // the top-level `index.html` and `favicon`, as well as stuff under
    // `static/`.
    app.use('/', express.static(path.resolve(Dirs.CLIENT_DIR, 'assets')));

    // Use the `api-server` module to handle POST and websocket requests at
    // `/api`.
    app.post('/api',
      (req, res) => {
        new PostConnection(req, res, this._context);
      });
    app.ws('/api',
      (ws, req) => {
        new WsConnection(ws, req, this._context);
      });
  }

  /**
   * Adds the dev mode routes.
   */
  _addDevModeRoutes() {
    const app = this._app;
    app.use('/debug', new DebugTools(this._doc).requestHandler);
  }

  /**
   * Maintains up-to-date bindings for the `rootAccess` object, based on the
   * root token(s) reported via `hooks-server.bearerTokens`. This includes
   * a promise-chain-based ongoing update mechanism.
   */
  _bindRoot() {
    const context = this._context;
    const rootTokens = Hooks.bearerTokens.rootTokens;

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
        context.add(t, this._rootAccess);
        log.info(`Accept root: ${t}`);
      }
      this._rootTokens = rootTokens;
    }

    // Wait for the token(s) to change, and then call this method recursively.
    Hooks.bearerTokens.whenRootTokensChange().then(() => {
      log.info('Root tokens updated.');
      this._bindRoot();
    });
  }
}
