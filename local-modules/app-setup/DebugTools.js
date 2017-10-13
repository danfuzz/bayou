// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import camelCase from 'camel-case';
import express from 'express';
import { inspect } from 'util';

import { Codec } from 'codec';
import { AuthorId, DocumentId } from 'doc-common';
import { DocServer } from 'doc-server';
import { Logger } from 'see-all';
import { RecentSink } from 'see-all-server';

/** Logger for this module. */
const log = new Logger('app-debug');

/** How long a log to maintain, in msec. */
const LOG_LENGTH_MSEC = 1000 * 60 * 60; // One hour.

/**
 * Introspection to help with debugging. Includes a request handler for hookup
 * to Express.
 */
export default class DebugTools {
  /**
   * Constructs an instance.
   *
   * @param {RootAccess} rootAccess The root access manager.
   */
  constructor(rootAccess) {
    /** {RootAccess} The root access manager. */
    this._rootAccess = rootAccess;

    /** {RecentSink} A rolling log for the `/log` endpoint. */
    this._sink = new RecentSink(LOG_LENGTH_MSEC);

    /** {Router} The router (request handler) for this instance. */
    this._router = new express.Router();
    this._addRoutes();
  }

  /**
   * The request handler function, suitable for use with Express. Usable as-is
   * (without `.bind()`).
   */
  get requestHandler() {
    return this._router;
  }

  /**
   * Adds all the routes needed for this instance.
   */
  _addRoutes() {
    const router = this._router;

    this._bindParam('authorId');
    this._bindParam('documentId');
    this._bindParam('revNum');

    this._bindHandler('change',      ':documentId/:revNum');
    this._bindHandler('client-test');
    this._bindHandler('edit',        ':documentId');
    this._bindHandler('edit',        ':documentId/:authorId');
    this._bindHandler('key',         ':documentId');
    this._bindHandler('key',         ':documentId/:authorId');
    this._bindHandler('log');
    this._bindHandler('snapshot',    ':documentId');
    this._bindHandler('snapshot',    ':documentId/:revNum');

    router.use(this._error.bind(this));
  }

  /**
   * Binds a parameter checker to the router for this instance.
   *
   * @param {string} name The name of the parameter.
   */
  _bindParam(name) {
    const checkerMethod = this[`_check_${name}`].bind(this);

    function checkParam(req, res_unused, next, value, name_unused) {
      try {
        checkerMethod(req, value);
        next();
      } catch (error) {
        next(error);
      }
    }

    this._router.param(name, checkParam);
  }

  /**
   * Binds a GET handler to the router for this instance.
   *
   * @param {string} name The name of the handler. This is also the first
   *   component of the bound path.
   * @param {string|null} [paramPath = null] The parameter path to accept, or
   *   `null` if there are no parameters. These become the remainder of the
   *   bound path.
   */
  _bindHandler(name, paramPath = null) {
    const fullPath = (paramPath === null)
      ? `/${name}`
      : `/${name}/${paramPath}`;
    const handlerMethod = this[`_handle_${camelCase(name)}`].bind(this);

    function handleRequest(req, res, next) {
      try {
        Promise.resolve(handlerMethod(req, res)).catch((error) => {
          next(error);
        });
      } catch (error) {
        next(error);
      }
    }

    this._router.get(fullPath, handleRequest);
  }

  /**
   * Validates an author ID as a request parameter.
   *
   * @param {object} req_unused HTTP request.
   * @param {string} value Request parameter value.
   */
  _check_authorId(req_unused, value) {
    try {
      AuthorId.check(value);
    } catch (error) {
      // Augment error and rethrow.
      error.debugMsg = 'Bad value for `authorId`.';
      throw error;
    }
  }

  /**
   * Validates a document ID as a request parameter.
   *
   * @param {object} req_unused HTTP request.
   * @param {string} value Request parameter value.
   */
  _check_documentId(req_unused, value) {
    try {
      DocumentId.check(value);
    } catch (error) {
      // Augment error and rethrow.
      error.debugMsg = 'Bad value for `documentId`.';
      throw error;
    }
  }

  /**
   * Validates a revision number as a request parameter. If valid, replaces the
   * parameter in the request object with the parsed form.
   *
   * @param {object} req HTTP request.
   * @param {string} value Request parameter value.
   */
  _check_revNum(req, value) {
    if (!value.match(/^[0-9]+$/)) {
      const error = new Error();
      error.debugMsg = 'Bad value for `revNum`.';
      throw error;
    }

    // Replace the string parameter with the actual parsed value.
    req.params.revNum = Number.parseInt(value);
  }

  /**
   * Gets a particular change to a document.
   *
   * @param {object} req HTTP request.
   * @param {object} res HTTP response handler.
   */
  async _handle_change(req, res) {
    const revNum = req.params.revNum;
    const body = this._getExistingBody(req);
    const change = (await body).getChange(revNum);
    const result = Codec.theOne.encodeJson(await change, true);

    this._textResponse(res, result);
  }

  /**
   * Runs the client tests. This operates by emitting a page that runs the
   * tests.
   *
   * @param {object} req_unused HTTP request.
   * @param {object} res HTTP response handler.
   */
  _handle_clientTest(req_unused, res) {
    // TODO: Probably want to use a real template.
    const head =
      '<title>Client Tests</title>\n' +
      '<link href="https://cdn.rawgit.com/mochajs/mocha/2.2.5/mocha.css" rel="stylesheet" />' +
      '<script src="https://cdn.rawgit.com/mochajs/mocha/2.2.5/mocha.js"></script>' +
      '<script src="/boot-for-test.js"></script>\n';
    const body =
      '<h1>Client Tests</h1>\n<div id="mocha"></div>';

    this._htmlResponse(res, head, body);
  }

  /**
   * Produces an authorization key for editing a document, and responds with
   * HTML which uses it. The result is an HTML page that includes the editor.
   *
   * @param {object} req HTTP request.
   * @param {object} res HTTP response handler.
   */
  async _handle_edit(req, res) {
    const documentId = req.params.documentId;
    const authorId   = this._getAuthorIdParam(req);
    const key        = await this._makeEncodedKey(documentId, authorId);

    // These are already strings (JSON-encoded even, in the case of `key`),
    // but we still have to JSON-encode _those_ strings, so as to make them
    // proper JS source within the <script> block below.
    const quotedKey        = JSON.stringify(key);
    const quotedDocumentId = JSON.stringify(documentId);
    const quotedAuthorId   = JSON.stringify(authorId);

    // TODO: Probably want to use a real template.
    const head =
      '<title>Editor</title>\n' +
      '<script>\n' +
      `  BAYOU_KEY         = ${quotedKey};\n` +
      `  DEBUG_AUTHOR_ID   = ${quotedAuthorId};\n` +
      `  DEBUG_DOCUMENT_ID = ${quotedDocumentId};\n` +
      '</script>\n' +
      '<script src="/boot-for-debug.js"></script>\n';
    const body =
      '<div id="debugEditor"><p>Loading&hellip;</p></div>\n';

    this._htmlResponse(res, head, body);
  }

  /**
   * Produces an authorization key for editing a document, and returns it
   * directly, as JSON.
   *
   * @param {object} req HTTP request.
   * @param {object} res HTTP response handler.
   */
  async _handle_key(req, res) {
    const documentId = req.params.documentId;
    const authorId   = this._getAuthorIdParam(req);
    const key        = await this._makeEncodedKey(documentId, authorId);

    this._jsonResponse(res, key);
  }

  /**
   * Gets the log.
   *
   * @param {object} req_unused HTTP request.
   * @param {object} res HTTP response handler.
   */
  _handle_log(req_unused, res) {
    // TODO: Format it nicely.
    const result = this._sink.htmlContents;

    this._htmlResponse(res, null, result);
  }

  /**
   * Gets a particular (or the latest) snapshot of a document.
   *
   * @param {object} req HTTP request.
   * @param {object} res HTTP response handler.
   */
  async _handle_snapshot(req, res) {
    const revNum = req.params.revNum;
    const body = this._getExistingBody(req);
    const args = (revNum === undefined) ? [] : [revNum];
    const snapshot = (await body).getSnapshot(...args);
    const result = Codec.theOne.encodeJson(await snapshot, true);

    this._textResponse(res, result);
  }

  /**
   * Error handler.
   *
   * **Note:** Express "knows" this is an error handler _explicitly_ because it
   * is defined to take four arguments. (Yeah, kinda precarious.)
   *
   * @param {Error} error Error that got thrown during request handling.
   * @param {object} req_unused HTTP request.
   * @param {object} res HTTP response.
   * @param {Function} next_unused Next handler to call.
   */
  _error(error, req_unused, res, next_unused) {
    let text = 'Error while handling debug URL:\n\n';

    if (error.debugMsg) {
      // We added our own message. Use that instead of just dumping a stack
      // trace.
      text += `    ${error.debugMsg}\n`;
    } else {
      // If there was no error message, then this isn't just (something like)
      // a user input error, so report the whole stack trace back.
      //
      // **Note:** It is reasonably safe to spew a stack trace back over the
      // connection because we should only be running code in this file at all
      // if the product is running in a dev (not production) configuration.
      log.error(error);
      text += inspect(error);
    }

    res
      .status(500)
      .type('text/plain')
      .send(text);
  }

  /**
   * Returns an existing document body based on the usual debugging request
   * argument. If the document doesn't exist, this method throws an error with a
   * reasonably-descriptive message.
   *
   * @param {object} req HTTP request.
   * @returns {BodyControl} Promise for the requested document.
   */
  async _getExistingBody(req) {
    const documentId  = req.params.documentId;
    const fileComplex = await DocServer.theOne.getFileComplex(documentId);
    const exists      = await fileComplex.file.exists();

    if (!exists) {
      const error = new Error();
      error.debugMsg = `No such document: ${documentId}`;
      throw error;
    }

    return fileComplex.bodyControl;
  }

  /**
   * Gets the author ID parameter of the given request, or the default value if
   * it wasn't supplied.
   *
   * @param {object} req The HTTP request.
   * @returns {string} The author ID.
   */
  _getAuthorIdParam(req) {
    return req.params.authorId || 'some-author';
  }

  /**
   * Makes and returns a new authorization key for the given document / author
   * combo, as a JSON-encoded string.
   *
   * @param {string} documentId The document ID.
   * @param {string} authorId The author ID.
   * @returns {string} A new `SplitKey` encoded as JSON.
   */
  async _makeEncodedKey(documentId, authorId) {
    const key = await this._rootAccess.makeAccessKey(authorId, documentId);
    return Codec.theOne.encodeJson(key);
  }

  /**
   * Responds with a `text/html` result. The given string is used as the
   * HTML body.
   *
   * @param {object} res HTTP response.
   * @param {string|null} head HTML head text, if any.
   * @param {string} body HTML body text.
   */
  _htmlResponse(res, head, body) {
    head = (head === null)
      ? ''
      : `<head>\n\n${head}\n</head>\n\n`;
    body = `<body>\n\n${body}\n</body>\n`;

    const html = `<!doctype html>\n<html>\n${head}${body}</html>\n`;

    res
      .status(200)
      .type('text/html; charset=utf-8')
      .send(html);
  }

  /**
   * Responds with an `application/json` result.
   *
   * @param {object} res HTTP response.
   * @param {string} json JSON text to respond with.
   */
  _jsonResponse(res, json) {
    res
      .status(200)
      .type('application/json; charset=utf-8')
      .send(json);
  }

  /**
   * Responds with a `text/plain` result.
   *
   * @param {object} res HTTP response.
   * @param {string} text Text to respond with.
   */
  _textResponse(res, text) {
    res
      .status(200)
      .type('text/plain; charset=utf-8')
      .send(text);
  }
}
