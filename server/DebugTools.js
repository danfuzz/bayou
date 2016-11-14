// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import express from 'express';

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
   }

   /**
    * Gets a particular change to the document.
    *
    * * `/change/NNN` -- Gets the change that produced version NNN of the
    *   document.
    */
   _change(req, res) {
     const match = req.url.match(/\/([0-9]+)$/);
     const version = Number.parseInt(match[1]);
     let result;

     try {
       const change = this._doc.change(version);
       result = JSON.stringify(change, null, 2);
     } catch (e) {
       result = `Error:\n\n${e.stack}`;
     }

     res
       .status(200)
       .type('text/plain')
       .send(result)
       .end();
   }

  /**
   * Gets a snapshot of the current document.
   *
   * * `/snapshot` -- Gets the latest version.
   * * `/snapshot/NNN` -- Gets version NNN.
   */
  _snapshot(req, res) {
    const match = req.url.match(/\/([0-9]+)$/);
    const version = match ? [Number.parseInt(match[1])] : [];
    let result;

    try {
      const snapshot = this._doc.snapshot(...version);
      result = JSON.stringify(snapshot, null, 2);
    } catch (e) {
      result = `Error:\n\n${e.stack}`;
    }

    res
      .status(200)
      .type('text/plain')
      .send(result)
      .end();
  }

  /**
   * The request handler function, suitable for use with Express. Usable as-is
   * (without `.bind()`).
   */
  get requestHandler() {
    const router = new express.Router();
    router.get(/^\/change\/[0-9]+$/,      this._change.bind(this));
    router.get(/^\/snapshot(\/[0-9]*)?$/, this._snapshot.bind(this));
    return router;
  }
}
