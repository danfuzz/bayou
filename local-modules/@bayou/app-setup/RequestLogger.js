// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { fromPairs } from 'lodash';
import { URL } from 'url';

import { Logger } from '@bayou/see-all';
import { CommonBase, Random } from '@bayou/util-common';

/**
 * HTTP request logging functions. This includes logging to an HTTP `access.log`
 * type file in a reasonably-usual format as well as logging to a developer
 * console. The latter is a status-aware logger, roughly based on `morgan`'s
 * built-in `dev` style, intended to produce concise logs for display on a
 * developer's console.
 */
export class RequestLogger extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Logger} log Logger to use.
   */
  constructor(log) {
    super();

    /** {Logger} Logger to use. */
    this._log = Logger.check(log);

    Object.freeze(this);
  }

  /**
   * {function} Express "middleware" function which performs request (and
   * response) logging.
   */
  get expressMiddleware() {
    return this._logExpressRequest.bind(this);
  }

  /**
   * Logs a websocket request.
   *
   * @param {object} req The HTTP request, which is assumed to be a
   *   successfully-upgraded websocket.
   * @param {array<string>} responseHeaderLines Response header, including
   *   status code and key-value pairs.
   */
  logWebsocketRequest(req, responseHeaderLines) {
    const id = Random.shortLabel('req');

    // Second arg (base URL) is needed because `req.url` doesn't come with a
    // protocol or host.
    const url     = new URL(req.url, 'http://x.x');

    const details = {
      ip:     req.socket.remoteAddress,
      method: req.method,
      query:  fromPairs([...url.searchParams])
    };

    this._log.event.websocketRequest(id, url.pathname, details);
    this._log.event.websocketRequestHeaders(id, req.headers);

    // Turn the response array into a status code and an object that matches the
    // form of the usual `headers` on an HTTP response object.

    const statusString    = responseHeaderLines[0].match(/^HTTP[^ ]* ([0-9]+)/)[1];
    const statusInt       = parseInt(statusString);
    const status          = isNaN(statusInt) ? statusString : statusInt;
    const responseHeaders = {};

    for (let i = 1; i < responseHeaderLines.length; i++) {
      const match = responseHeaderLines[i].match(/([^:]+): *(.*[^ ]) *$/);
      responseHeaders[match[1].toLowerCase()] = match[2];
    }

    this._log.event.websocketResponse(id, status, responseHeaders);
  }

  /**
   * Standard Express middleware implementation, underlying the property
   * {@link #expressMiddleware}.
   *
   * @param {object} req The HTTP request.
   * @param {object} res The HTTP response.
   * @param {function} next Function to call in order to continue request
   *   dispatch.
   */
  _logExpressRequest(req, res, next) {
    const id = Random.shortLabel('req');

    // **Note:** This doesn't include `url` or `headers`, as those end up in the
    // top level of the logged event because they are so handy and deserve
    // prominent placement.
    const details = {
      ip:       req.ip,
      method:   req.method,
      query:    req.query
    };

    this._log.event.httpRequest(id, req.originalUrl, details);
    this._log.event.httpRequestHeaders(id, req.headers);

    res.on('finish', () => {
      // Make the headers a plain object, so it gets logged in a clean
      // fashion.
      const responseHeaders = Object.assign({}, res.getHeaders());
      this._log.event.httpResponse(id, res.statusCode, responseHeaders);
    });

    next();
  }
}
