// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import express from 'express';

import SeeAllRecent from 'see-all-recent';

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
    * @param doc The `Document` object managed by this process.
    */
   constructor(doc) {
     /** The `Document` object. */
     this._doc = doc;

     /** A rolling log for the `/log` endpoint. */
     this._logger = new SeeAllRecent(LOG_LENGTH_MSEC);
   }

   /**
    * Gets the log.
    */
   _log(req, res) {
      let result;

      try {
        // TODO: Format it nicely.
        const contents = this._logger.htmlContents;
        result = `<html><body>${contents}</body></html>`
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
    */
   _change(req, res) {
     const match = req.url.match(/\/([0-9]+)$/);
     const verNum = Number.parseInt(match[1]);
     let result;

     try {
       const change = this._doc.change(verNum);
       result = JSON.stringify(change, null, 2);
     } catch (e) {
       result = `Error:\n\n${e.stack}`;
     }

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
   */
  _snapshot(req, res) {
    const match = req.url.match(/\/([0-9]+)$/);
    const verNum = match ? [Number.parseInt(match[1])] : [];
    let result;

    try {
      const snapshot = this._doc.snapshot(...verNum);
      result = JSON.stringify(snapshot, null, 2);
    } catch (e) {
      result = `Error:\n\n${e.stack}`;
    }

    res
      .status(200)
      .type('text/plain')
      .send(result);
  }

  /**
   * The request handler function, suitable for use with Express. Usable as-is
   * (without `.bind()`).
   */
  get requestHandler() {
    const router = new express.Router();
    router.get(/^\/change\/[0-9]+$/,      this._change.bind(this));
    router.get('/log',                    this._log.bind(this));
    router.get(/^\/snapshot(\/[0-9]*)?$/, this._snapshot.bind(this));
    return router;
  }
}
