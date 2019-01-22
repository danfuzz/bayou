// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import express from 'express';
import http from 'http';

import { ProductInfo } from '@bayou/env-server';
import { Logger } from '@bayou/see-all';
import { TInt } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

import Application from './Application';
import RequestLogger from './RequestLogger';
import ServerUtil from './ServerUtil';
import VarInfo from './VarInfo';

/** {Logger} Logger. */
const log = new Logger('app-monitor');

/**
 * Web server for the monitoring endpoints.
 */
export default class Monitor extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Application} mainApplication The main application instance.
   * @param {Int} port The port to listen on.
   */
  constructor(mainApplication, port) {
    super();

    /** {Application} The main application instance. */
    this._mainApplication = Application.check(mainApplication);

    /** {Int} The port to listen on. */
    this._port = TInt.nonNegative(port);

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
  }

  /**
   * Starts up the server.
   */
  async start() {
    const server     = this._server;
    const port       = this._port;
    const resultPort = await ServerUtil.listen(server, port);

    log.info(`Monitor server port: ${resultPort}`);

    if ((port !== 0) && (port !== resultPort)) {
      log.warn(`Originally requested port: ${port}`);
    }
  }

  /**
   * Sets up the webserver routes.
   */
  _addRoutes() {
    const app = this._app;

    // Logging.
    app.use(this._requestLogger.expressMiddleware);

    app.get('/health', async (req_unused, res) => {
      const [status, text] = await this._mainApplication.isHealthy()
        ? [200, '🍑 Everything\'s peachy! 🍑\n']
        : [503, '😿 Sorry to say we can\'t help you right now. 😿\n'];

      Monitor._sendTextResponse(res, status, 'text/plain', text);
    });

    app.get('/info', async (req_unused, res) => {
      Monitor._sendJsonResponse(res, ProductInfo.theOne.INFO);
    });

    const varInfo = new VarInfo();
    app.get('/var', async (req_unused, res) => {
      const info = await varInfo.get();

      Monitor._sendJsonResponse(res, info);
    });
  }

  /**
   * Sends a successful JSON-bearing HTTP response.
   *
   * @param {http.ServerResponse} res The response object representing the
   *   connection to send to.
   * @param {object} body The body of the response, as a JSON-encodable object.
   */
  static _sendJsonResponse(res, body) {
    const text = `${JSON.stringify(body, null, 2)}\n`;

    Monitor._sendTextResponse(res, 200, 'application/json', text);
  }

  /**
   * Sends a text-content HTTP response.
   *
   * @param {http.ServerResponse} res The response object representing the
   *   connection to send to.
   * @param {int} statusCode The response status code.
   * @param {string} contentType The content type, _without_ a charset. (The
   *   charset is always set to be `utf-8`.)
   * @param {string} body The body of the response, as a string.
   */
  static _sendTextResponse(res, statusCode, contentType, body) {
    res
      .status(statusCode)
      .type(`${contentType}; charset=utf-8`)
      .set('Cache-Control', 'no-cache, no-store, no-transform')
      .send(body);
  }
}
