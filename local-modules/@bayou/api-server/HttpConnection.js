// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import contentType from 'content-type';

import { BaseConnection } from './BaseConnection';

/**
 * Partial implementation of {@link BaseConnection}, for all connections that
 * use HTTP transport including a usual "request" object.
 */
export class HttpConnection extends BaseConnection {
  /**
   * Constructs an instance.
   *
   * @param {object} req The HTTP request.
   * @param {ContextInfo} contextInfo Construction info for the {@link Context}
   *   to use.
   */
  constructor(req, contextInfo) {
    super(contextInfo);

    /** {object} The HTTP request. */
    this._req = req;
  }

  /** {object} The HTTP request headers. */
  get requestHeaders() {
    return this._req.headers;
  }

  /**
   * Implementation of method as required by the superclass.
   *
   * @param {string} name Name of the cookie in question.
   * @returns {string|null} Cookie value, or `null` if there is no cookie with
   *   the given `name`.
   */
  _impl_getCookie(name) {
    // **TODO:** Fill me in!
    return null;
  }
}
