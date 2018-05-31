// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Logger } from '@bayou/see-all';
import { CommonBase, Random } from '@bayou/util-common';

/**
 * HTTP request logging functions. This includes logging to an HTTP `access.log`
 * type file in a reasonably-usual format as well as logging to a developer
 * console. The latter is a status-aware logger, roughly based on `morgan`'s
 * built-in `dev` style, intended to produce concise logs for display on a
 * developer's console.
 */
export default class RequestLogger extends CommonBase {
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
    return this._logRequest.bind(this);
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
  _logRequest(req, res, next) {
    const isWs = RequestLogger._isWsRequest(req);

    // `express-ws` appends a pseudo-path `/.websocket` to the end of
    // websocket requests. We chop that off here.
    const url = isWs
      ? req.originalUrl.replace(/[/]\.websocket$/, '')
      : req.originalUrl;

    // **Note:** `url` is put in the top-level event and not the details
    // because it is so handy and deserves prominent placement.
    const requestDetails = {
      hostname: req.hostname,
      ip:       req.ip,
      method:   req.method,
      params:   req.params,
      query:    req.query
    };

    if (isWs) {
      this._log.event.wsRequest(url, requestDetails, req.headers);
    } else {
      const id = Random.shortLabel('req');

      this._log.event.httpRequest(id, url, requestDetails, req.headers);

      res.on('finish', () => {
        // Make the headers a plain object, so it gets logged in a clean
        // fashion.
        const responseHeaders = Object.assign({}, res.getHeaders());
        this._log.event.httpResponse(id, res.statusCode, responseHeaders);
      });
    }

    next();
  }

  /**
   * Returns whether or not the given request is a websocket request.
   *
   * @param {object} req Request object.
   * @returns {boolean} `true` iff the given request is a websocket request.
   */
  static _isWsRequest(req) {
    // Case doesn't matter, hence the regex test instead of just `===`.
    const upgrade = req.get('upgrade');
    return (upgrade !== undefined) && upgrade.match(/^websocket$/i);
  }
}
