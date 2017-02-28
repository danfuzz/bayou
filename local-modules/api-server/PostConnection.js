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

    res
      .status(200)
      .type('application/json')
      .send('{"id": -1, "error": "TODO"}\n');
  }
}
