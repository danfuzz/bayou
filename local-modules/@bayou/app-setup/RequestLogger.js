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

    this._logRequest(id, req, 'websocket');

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

    this._logRequest(id, req, 'http');

    res.on('finish', () => {
      // Make the headers a plain object, so it gets logged in a clean
      // fashion.
      const responseHeaders = Object.assign({}, res.getHeaders());
      this._log.event.httpResponse(id, res.statusCode, responseHeaders);
    });

    next();
  }

  /**
   * Helper for both regular and websocket loggers, which does the main request
   * logging.
   *
   * @param {string} id The request ID.
   * @param {object} req The HTTP request.
   * @param {string} prefix The prefix for the event names.
   */
  _logRequest(id, req, prefix) {
    const ip     = req.socket.remoteAddress;
    const method = req.method;

    // If this is a normal HTTP request, we'll have a good value for
    // `originalUrl` but a possibly-altered `url` (because of routing). And for
    // a websocket request, we'll end up with `originalUrl === undefined` and an
    // unmodified `url`. In either case the URL value is missing both protocol
    // and host. So, we "fluff out" the URL with valid throwaway bits, and just
    // end up extracting the (non-throwaway) parts we want to log.
    const url = new URL(req.originalUrl || req.url, 'http://x.x');

    // Similarly, `query` will be set up with a normal HTTP request, but not
    // for a websocket request, in which case we extract it out of `url`.
    const query = req.query || fromPairs([...url.searchParams]);

    // **Note:** This doesn't include `url` or `headers`, as those are prominent
    // enough to deserve special treatment (separate argument and separate
    // event, respectively).
    const details = { ip, method, query };

    const baseEvent = `${prefix}Request`;

    this._log.event[baseEvent](id, url.pathname, details);
    this._log.event[`${baseEvent}Headers`](id, req.headers);
  }
}
