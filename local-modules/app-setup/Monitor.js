// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import express from 'express';
import http from 'http';
import { promisify } from 'util';

import { Hooks } from 'hooks-server';
import { Logger } from 'see-all';
import { CommonBase } from 'util-common';

import Application from './Application';

/** Logger. */
const log = new Logger('app-monitor');

/**
 * Web server for the monitoring endpoints.
 */
export default class Monitor extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Application} mainApplication The main application instance.
   */
  constructor(mainApplication) {
    super();

    /** {Application} The main application instance. */
    this._mainApplication = Application.check(mainApplication);

    /**
     * {function} The top-level "Express application" run by this instance. It
     * is a request handler function which is suitable for use with Node's
     * `http` library.
     */
    this._app = express();

    /** {http.Server} The server that directly answers HTTP requests. */
    this._server = http.createServer(this._app);

    this._addRequestLogging();
    this._addRoutes();
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
    const port   = pickPort ? 0 : Hooks.theOne.monitorPort;
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
    const app = this._app;

    app.use((req, res_unused, next) => {
      log.event.httpRequest(req.originalUrl);
      next();
    });
  }

  /**
   * Sets up the webserver routes.
   */
  _addRoutes() {
    const app = this._app;

    app.get('/health', async (req_unused, res) => {
      const [status, text] = await this._app.isHealthy()
        ? [200, '🍑 Everything\'s peachy! 🍑\n']
        : [503, '😿 Sorry to say we can\'t help you right now. 😿\n'];

      res
        .status(status)
        .type('text/plain; charset=utf-8')
        .send(text);
    });
  }
}
