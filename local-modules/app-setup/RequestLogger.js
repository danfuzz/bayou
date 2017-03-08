// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import chalk from 'chalk';
import morgan from 'morgan';

/**
 * HTTP request logging functions. This includes logging to an HTTP `access.log`
 * type file in a reasonably-usual format as well as logging to a developer
 * console. The latter is a status-aware logger, roughly based on `morgan`'s
 * built-in `dev` style, intended to produce concise logs for display on a
 * developer's console.
 */
export default class RequestLogger {
  /**
   * Add all the loggers for the given application.
   *
   * @param {object} app The `express` application.
   * @param {object} consoleStream The stream to write console logs to.
   * @param {object} accessStream The stream to write HTTP access logs to.
   */
  static addLoggers(app, consoleStream, accessStream) {
    // These log regular (non-websocket) requests, at the time of completion.

    app.use(morgan(
      RequestLogger._makeConsoleLogEnd,
      {
        stream: consoleStream
      }
    ));

    app.use(morgan(
      'common',
      {
        stream: accessStream
      }
    ));

    // These log websocket requests, at the time of request start (not at the
    // time of completion because these are long-lived requests).

    app.use(morgan(
      RequestLogger._makeConsoleLogStart,
      {
        stream:    consoleStream,
        immediate: true
      }
    ));

    app.use(morgan(
      'common',
      {
        stream:    accessStream,
        immediate: true
      }
    ));
  }

  static _makeConsoleLogStart(tokens_unused, req, res_unused) {
    return RequestLogger._makeConsoleLog(req, null);
  }

  static _makeConsoleLogEnd(tokens_unused, req, res) {
    return RequestLogger._makeConsoleLog(req, res);
  }

  /**
   * Helper for the console logger methods, which does most of the work. If
   * `res` is passed as `null`, this indicates that the logging is being done at
   * the start of the request, so (e.g.) things like content length won't be
   * available.
   *
   * @param {object} req Request object.
   * @param {object|null} res Response object.
   * @returns {string} String to log.
   */
  static _makeConsoleLog(req, res) {
    const isWebsocket = RequestLogger._isWebsocketRequest(req);

    if ((res === null) && !isWebsocket) {
      // We skip start-of-request logging for everything but websockets.
      return null;
    }

    const status    = (res === null) ? 0 : (res.statusCode || 0);
    const statusStr = `${status || '-'}  `.slice(0, 3);
    const colorFn   = RequestLogger._colorForStatus(status);
    const method    = `${isWebsocket ? 'WS' : req.method}   `.slice(0,4);

    // `express-ws` appends a pseudo-path `/.websocket` to the end of
    // websocket requests. We chop that off here.
    const url = isWebsocket
      ? req.originalUrl.replace(/\/\.websocket$/, '')
      : req.originalUrl;

    let contentLength = (res === null) ? undefined : res.get('content-length');
    if (contentLength === undefined) {
      contentLength = '-';
    } else if (contentLength > (1024 * 1024)) {
      contentLength = `${Math.round(contentLength / 1024 / 1024 * 10) / 10}M`;
    } else if (contentLength > 1024) {
      contentLength = `${Math.round(contentLength / 1024 * 10) / 10}K`;
    } else {
      contentLength = `${contentLength}B`;
    }

    if (contentLength.length < 7) {
      contentLength += ' '.repeat(7 - contentLength.length);
    }

    return `${colorFn(statusStr)} ${contentLength} ${method} ${url}`;
  }

  /**
   * Given an HTTP status, returns the corresponding `chalk` coloring function,
   * or a no-op function if the status doesn't demand colorization.
   *
   * @param {number} status The HTTP status code.
   * @returns {function} The corresponding coloring function.
   */
  static _colorForStatus(status) {
    if      (status >= 500) { return chalk.red;    }
    else if (status >= 400) { return chalk.yellow; }
    else if (status >= 300) { return chalk.cyan;   }
    else if (status >= 200) { return chalk.green;  }
    else                    { return ((x) => x);   } // No-op by default.
  }

  /**
   * Returns whether or not the given request is a websocket request.
   *
   * @param {object} req Request object.
   * @returns {boolean} `true` iff the given request is a websocket request.
   */
  static _isWebsocketRequest(req) {
    // Case doesn't matter, hence the regex test instead of just `===`.
    const upgrade = req.get('upgrade');
    return (upgrade !== undefined) && upgrade.match(/^websocket$/i);
  }
}
