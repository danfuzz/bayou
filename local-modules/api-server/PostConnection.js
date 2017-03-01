// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Connection from './Connection';

/**
 * Direct handler for one-shot API requests that arrive over a standard HTTP
 * POST.
 */
export default class PostConnection extends Connection {
  /**
   * Constructs an instance. As a side effect, the contructor attaches the
   * constructed instance to the HTTP request, and arranges to respond.
   *
   * @param {object} req The HTTP request.
   * @param {object} res The HTTP response handler.
   * @param {TargetMap} targets The targets to provide access to.
   */
  constructor(req, res, targets) {
    super(targets);

    /** {object} The HTTP request. */
    this._req = req;

    /** {object} The HTTP response. */
    this._res = res;

    /** {Array<Buffer>} The request POST payload, as individual chunks. */
    this._chunks = [];

    req.on('data', this._handleData.bind(this));
    req.on('end', this._handleEnd.bind(this));
    req.on('error', this._handleError.bind(this));
  }

  /**
   * Handles a `data` event coming from the request input stream.
   *
   * @param {Buffer} chunk Incoming data chunk.
   */
  _handleData(chunk) {
    this._log.detail('Chunk:', chunk);
    this._chunks.push(chunk);
  }

  /**
   * Handles an `end` event coming from the request input stream.
   */
  _handleEnd() {
    this._log.info('Close.');

    const msg = Buffer.concat(this._chunks).toString('utf8');
    this.handleJsonMessage(msg).then(
      (response) => {
        this._res
          .status(200)
          .type('application/json')
          .send(response);
      });
  }

  /**
   * Handles an `error` event coming from the underlying connection.
   *
   * @param {object} error The error event.
   */
  _handleError(error) {
    this._log.info('Error:', error);

    this._res
    .status(400) // "Bad Request" status code.
    .type('application/json')
    .send('{"id": -1, "error": "Trouble receiving POST payload."}\n');
  }
}
