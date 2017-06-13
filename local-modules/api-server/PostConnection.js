// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import contentType from 'content-type';

import { Hooks } from 'hooks-server';

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
   * @param {Context} context The binding context to provide access to.
   */
  constructor(req, res, context) {
    super(context, Hooks.theOne.baseUrlFromRequest(req));

    /** {object} The HTTP request. */
    this._req = req;

    /** {object} The HTTP response. */
    this._res = res;

    /** {Array<Buffer>} The request POST payload, as individual chunks. */
    this._chunks = [];

    const contentTypeError = this._validateContentType();
    if (contentTypeError) {
      this._respond400(`Invalid \`Content-Type\`: ${contentTypeError}`);
      return;
    }

    req.on('data', this._handleData.bind(this));
    req.on('end', this._handleEnd.bind(this));
    req.on('error', this._handleError.bind(this));
  }

  /**
   * Validates the `Content-Type` header. Returns `null` if valid or an error
   * string if invalid.
   *
   * @returns {string|null} The error, if any.
   */
  _validateContentType() {
    const headerString = this._req.headers['content-type'];
    if (!headerString) {
      return 'Missing header.';
    }

    try {
      const parsed = contentType.parse(headerString);
      const type = parsed.type;
      const params = parsed.parameters;
      if (type !== 'application/json') {
        return 'Must specify media type `application/json`.';
      } else if (!params.charset) {
        return 'Missing `charset` specifier.';
      } else if (params.charset !== 'utf-8') {
        return 'Must specify `charset` as `utf-8`.';
      } else if (Object.keys(params).length !== 1) {
        return 'Superfluous parameters.';
      }
    } catch (e) {
      return 'Invalid syntax.';
    }

    return null;
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
    this._log.info('Received message.');

    const msg = Buffer.concat(this._chunks).toString('utf8');
    this.handleJsonMessage(msg).then((response) => {
      this._res
        .status(200)
        .type('application/json')
        .send(response);
      this.close();
    });
  }

  /**
   * Handles an `error` event coming from the underlying connection.
   *
   * @param {object} error The error event.
   */
  _handleError(error) {
    // Not logged as `.error()` because it's not an application error (at least
    // not on this side).
    this._log.info('Error event:', error);
    this._respond400('Trouble receiving POST payload.');
    this.close();
  }

  /**
   * Responds to the request with a 400 ("Bad Request") response, with a JSON
   * payload that includes the given error message.
   *
   * @param {string} error Message to report.
   */
  _respond400(error) {
    const payload = JSON.stringify({ id: -1, error });

    // Not logged as `.error()` because it's not an application error (at least
    // not on this side).
    this._log.info('Error:', error);

    this._res
    .status(400)
    .type('application/json')
    .send(payload);
  }
}
