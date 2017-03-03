// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import express from 'express';
import util from 'util';

import { Encoder } from 'api-common';
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
   * @param {DocServer} doc The `DocServer` object managed by this process.
   */
  constructor(doc) {
    /** The `Document` object. */
    this._doc = doc;

    /** A rolling log for the `/log` endpoint. */
    this._logger = new SeeAllRecent(LOG_LENGTH_MSEC);
  }

  /**
   * Gets the log.
   *
   * @param {object} req_unused HTTP request.
   * @param {object} res HTTP response handler.
   */
  _log(req_unused, res) {
    let result;

    try {
      // TODO: Format it nicely.
      const contents = this._logger.htmlContents;
      result = `<html><body>${contents}</body></html>`;
    } catch (e) {
      result = `Error:\n\n${e.stack}`;
    }

    res
      .status(200)
      .type('text/html')
      .send(result);
  }

  /**
   * Gets a particular change to the document.
   *
   * * `/change/NNN` -- Gets the change that produced version NNN of the
   *   document.
   *
   * @param {object} req HTTP request.
   * @param {object} res HTTP response handler.
   */
  _change(req, res) {
    const match = req.url.match(/\/([0-9]+)$/);
    const verNum = Number.parseInt(match[1]);
    const change = this._doc.change(verNum);
    const result = Encoder.encodeJson(change, 2);

    res
      .status(200)
      .type('text/plain')
      .send(result);
  }

  /**
   * Gets a snapshot of the current document.
   *
   * * `/snapshot` -- Gets the current (latest) version.
   * * `/snapshot/NNN` -- Gets version NNN.
   *
   * @param {object} req HTTP request.
   * @param {object} res HTTP response handler.
   */
  _snapshot(req, res) {
    const match = req.url.match(/\/([0-9]+)$/);
    const verNum = match ? [Number.parseInt(match[1])] : [];
    const snapshot = this._doc.snapshot(...verNum);
    const result = Encoder.encodeJson(snapshot, true);

    res
      .status(200)
      .type('text/plain')
      .send(result);
  }

  /**
   * Validates a version number as a request parameter.
   *
   * @param {object} req_unused Express request.
   * @param {object} res_unused Express response.
   * @param {Function} next Next handler to call.
   * @param {string} value Request parameter value.
   * @param {string} name_unused Request parameter name.
   */
  _check_verNum(req_unused, res_unused, next, value, name_unused) {
    if (!value.match(/^[0-9]+$/)) {
      const error = new Error();
      error.debugMsg = 'Bad value for `verNum`.';
      throw error;
    }

    next();
  }

  /**
   * The request handler function, suitable for use with Express. Usable as-is
   * (without `.bind()`).
   */
  get requestHandler() {
    const router = new express.Router();

    router.get('/change/:verNum',   this._change.bind(this));
    router.get('/log',              this._log.bind(this));
    router.get('/snapshot',         this._snapshot.bind(this));
    router.get('/snapshot/:verNum', this._snapshot.bind(this));

    router.param('verNum', this._check_verNum.bind(this));

    // Error handler. Express "knows" this is an error handler _explicitly_
    // because it is defined to take four arguments. (Yeah, kinda precarious.)
    router.use((err, req_unused, res, next_unused) => {
      let text = 'Error while handling debug URL:\n\n';

      if (err.debugMsg) {
        // We added our own message. Use that instead of just dumping a
        // stack trace.
        text += `    ${err.debugMsg}\n`;
      } else {
        // If there was no error message, then this isn't just (something like)
        // a user input error, so report the whole stack trace back.
        //
        // **Note:** It is reasonably safe to spew a stack trace back over the
        // connection because we should only be running code in this file at all
        // if the product is running in a dev (not production) configuration.
        log.error(err);
        text += util.inspect(err);
      }

      res
        .status(500)
        .type('text/plain')
        .send(text);
    });

    return router;
  }
}
