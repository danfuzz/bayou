// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import contentType from 'content-type';

import { HttpConnection } from './HttpConnection';

/**
 * Direct handler for one-shot API requests that arrive over a standard HTTP
 * POST.
 */
export class PostConnection extends HttpConnection {
  /**
   * Constructs an instance. As a side effect, the contructor attaches the
   * constructed instance to the HTTP request, and arranges to respond.
   *
   * @param {object} req The HTTP request.
   * @param {object} res The HTTP response handler.
   * @param {ContextInfo} contextInfo Construction info for the {@link Context}
   *   to use.
   */
  constructor(req, res, contextInfo) {
    super(req, contextInfo);

    /** {object} The HTTP response. */
    this._res = res;

    /** {array<Buffer>} The request POST payload, as individual chunks. */
    this._chunks = [];

    const contentTypeError = this._validateContentType();
    if (contentTypeError) {
      this._respond400(`Invalid \`Content-Type\`: ${contentTypeError}`);
      return;
    }

    req.on('data', this._handleData.bind(this));
    req.on('end', this._handleEnd.bind(this));
    req.on('error', this._handleError.bind(this));

    Object.seal(this);
  }

  /**
   * Implementation of method as required by the superclass.
   */
  async _impl_close() {
    // Wait for the response to be completed, and then return. Per the base
    // class docs, this method isn't supposed to hastily cut off an operation,
    // and since a POST connection only handles a single call, the best we can
    // do is just wait for that one call to get naturally completed.

    const response = this._res;

    if (!response.finished) {
      const whenFinished = new Promise((resolve) => {
        response.once('finish', () => resolve(true));
      });

      await whenFinished;
    }
  }

  /**
   * Implementation of method as required by the superclass.
   *
   * @returns {boolean} `true` if the connection is open, or `false` if not.
   */
  _impl_isOpen() {
    const response = this._res;

    return (response.socket !== null) && response.finished;
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
  async _handleEnd() {
    this._log.event.receivedPost();

    const msg          = Buffer.concat(this._chunks).toString('utf8');
    const response     = await this.handleJsonMessage(msg);
    const responseText = `${response}\n`;

    this._res
      .status(200)
      .type('application/json')
      .send(responseText);

    await this.close();
  }

  /**
   * Handles an `error` event coming from the underlying connection.
   *
   * @param {object} error The error event.
   */
  async _handleError(error) {
    // Not logged as `.error()` because it's not an application error (at least
    // not on this side).
    this._log.info('Error event:', error);
    this._respond400('Trouble receiving POST payload.');

    await this.close();
  }

  /**
   * Responds to the request with a 400 ("Bad Request") response, with a JSON
   * payload that includes the given error message.
   *
   * @param {string} error Message to report.
   */
  _respond400(error) {
    const response     = { id: -1, error };
    const responseText = `${JSON.stringify(response)}\n`;

    // Not logged as `.error()` because it's not an application error (at least
    // not on this side).
    this._log.info('Error:', error);

    this._res
      .status(400)
      .type('application/json')
      .send(responseText);
  }

  /**
   * Validates the `Content-Type` header. Returns `null` if valid or an error
   * string if invalid.
   *
   * @returns {string|null} The error, if any.
   */
  _validateContentType() {
    const headerString = this.getHeader('content-type');
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
}
