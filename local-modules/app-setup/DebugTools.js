// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import express from 'express';
import util from 'util';

import { Encoder } from 'api-common';
import { BayouMocha } from 'bayou-mocha';
import { AuthorId, DocumentId } from 'doc-common';
import { DocServer } from 'doc-server';
import { SeeAll } from 'see-all';
import { SeeAllRecent } from 'see-all-server';

/** Logger for this module. */
const log = new SeeAll('app-debug');

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

    /** {SeeAll} A rolling log for the `/log` endpoint. */
    this._logger = new SeeAllRecent(LOG_LENGTH_MSEC);
  }

  /**
   * The request handler function, suitable for use with Express. Usable as-is
   * (without `.bind()`).
   */
  get requestHandler() {
    const router = new express.Router();

    this._bindParam(router, 'authorId');
    this._bindParam(router, 'documentId');
    this._bindParam(router, 'verNum');

    router.get('/change/:documentId/:verNum',   this._handle_change.bind(this));
    router.get('/edit/:documentId',             this._handle_edit.bind(this));
    router.get('/edit/:documentId/:authorId',   this._handle_edit.bind(this));
    router.get('/key/:documentId',              this._handle_key.bind(this));
    router.get('/key/:documentId/:authorId',    this._handle_key.bind(this));
    router.get('/log',                          this._handle_log.bind(this));
    router.get('/snapshot/:documentId',         this._handle_snapshot.bind(this));
    router.get('/snapshot/:documentId/:verNum', this._handle_snapshot.bind(this));
    router.get('/test',                         this._handle_test.bind(this));

    router.use(this._error.bind(this));

    return router;
  }

  _bindParam(router, name) {
    const checkerMethod = this[`_check_${name}`].bind(this);

    function checkParam(req, res, next, value, name_unused) {
      try {
        checkerMethod(req, res, value);
        next();
      } catch (error) {
        next(error);
      }
    }

    router.param(name, checkParam);
  }

  /**
   * Validates an author ID as a request parameter.
   *
   * @param {object} req_unused HTTP request.
   * @param {object} res_unused HTTP response.
   * @param {string} value Request parameter value.
   */
  _check_authorId(req_unused, res_unused, value) {
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
   * @param {object} res_unused HTTP response.
   * @param {string} value Request parameter value.
   */
  _check_documentId(req_unused, res_unused, value) {
    try {
      DocumentId.check(value);
    } catch (error) {
      // Augment error and rethrow.
      error.debugMsg = 'Bad value for `documentId`.';
      throw error;
    }
  }

  /**
   * Validates a version number as a request parameter. If valid, replaces the
   * parameter in the request object with the parsed form.
   *
   * @param {object} req HTTP request.
   * @param {object} res_unused HTTP response.
   * @param {string} value Request parameter value.
   */
  _check_verNum(req, res_unused, value) {
    if (!value.match(/^[0-9]+$/)) {
      const error = new Error();
      error.debugMsg = 'Bad value for `verNum`.';
      throw error;
    }

    // Replace the string parameter with the actual parsed value.
    req.params.verNum = Number.parseInt(value);
  }

  /**
   * Gets a particular change to a document.
   *
   * @param {object} req HTTP request.
   * @param {object} res HTTP response handler.
   */
  _handle_change(req, res) {
    const verNum = req.params.verNum;
    const doc = this._getExistingDoc(req);
    const change = doc.change(verNum);
    const result = Encoder.encodeJson(change, true);

    this._textResponse(res, result);
  }

  /**
   * Produces an authorization key for editing a document, and responds with
   * HTML which uses it. The result is an HTML page that includes the editor.
   *
   * @param {object} req HTTP request.
   * @param {object} res HTTP response handler.
   */
  _handle_edit(req, res) {
    const documentId = req.params.documentId;
    const authorId   = this._getAuthorIdParam(req);
    const key        = this._makeEncodedKey(documentId, authorId);

    // These are already strings (JSON-encoded even, in the case of `key`), but
    // we still have to JSON-encode _those_ strings, so as to make them proper
    // JS source within the <script> block below.
    const quotedKey        = JSON.stringify(key);
    const quotedDocumentId = JSON.stringify(documentId);
    const quotedAuthorId   = JSON.stringify(authorId);

    // TODO: Probably want to use a real template.
    const head =
      '<title>Editor</title>\n' +
      '<script>\n' +
      `  BAYOU_KEY         = ${quotedKey};\n` +
      '  BAYOU_NODE        = "#editor";\n' +
      `  DEBUG_AUTHOR_ID   = ${quotedAuthorId};\n` +
      `  DEBUG_DOCUMENT_ID = ${quotedDocumentId};\n` +
      '</script>\n' +
      '<script src="/boot-for-debug.js"></script>\n';
    const body =
      '<h1>Editor</h1>\n' +
      '<div id="editor"><p>Loading&hellip;</p></div>\n';

    this._htmlResponse(res, head, body);
  }

  /**
   * Produces an authorization key for editing a document, and returns it
   * directly, as JSON.
   *
   * @param {object} req HTTP request.
   * @param {object} res HTTP response handler.
   */
  _handle_key(req, res) {
    const documentId = req.params.documentId;
    const authorId   = this._getAuthorIdParam(req);
    const key        = this._makeEncodedKey(documentId, authorId);

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
    const result = this._logger.htmlContents;

    this._htmlResponse(res, null, result);
  }

  /**
   * Gets a particular (or the latest) snapshot of a document.
   *
   * @param {object} req HTTP request.
   * @param {object} res HTTP response handler.
   */
  _handle_snapshot(req, res) {
    const verNum = req.params.verNum;
    const doc = this._getExistingDoc(req);
    const args = (verNum === undefined) ? [] : [verNum];
    const snapshot = doc.snapshot(...args);
    const result = Encoder.encodeJson(snapshot, true);

    this._textResponse(res, result);
  }

  /**
   * Runs unit tests
   *
   * @param {object} req_unused HTTP request.
   * @param {object} res HTTP response handler.
   */
  _handle_test(req_unused, res) {
    BayouMocha.runAllTests();

    this._textResponse(res, 'Unit tests are running. See server console output for results.');
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
      text += util.inspect(error);
    }

    res
      .status(500)
      .type('text/plain')
      .send(text);
  }

  /**
   * Gets an existing document based on the usual debugging request argument, or
   * throws an error if the document doesn't exist.
   *
   * @param {object} req HTTP request.
   * @returns {DocControl} The requested document.
   */
  _getExistingDoc(req) {
    const documentId = req.params.documentId;
    const doc = DocServer.theOne.getDocOrNull(documentId);

    if (doc === null) {
      const error = new Error();
      error.debugMsg = `No such document: ${documentId}`;
      throw error;
    }

    return doc;
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
   * combo.
   *
   * @param {string} documentId The document ID.
   * @param {string} authorId The author ID.
   * @returns {string} A new `SplitKey` encoded as JSON.
   */
  _makeEncodedKey(documentId, authorId) {
    return Encoder.encodeJson(
      this._rootAccess.makeAccessKey(authorId, documentId));
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
