// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';
import { InfoError } from 'util-common';

/**
 * Error class for reporting errors coming from `ApiClient`. Differentiates
 * between connection/transport errors and application logic errors.
 *
 * **Note:** This class is defined to be a subclass of `Error` because instances
 * are most typically used as the rejection "reason" for promises, and rejection
 * reasons are generally expected to be instances of `Error`. That said, the
 * stack trace associated with these instances will almost never be useful, as
 * they will almost always get thrown most directly from API handler code.
 */
export default class ApiError extends InfoError {
  /**
   * {string} Error name which indicates trouble with the connection (as opposed
   * to, say, an application logic error).
   */
  static get CONNECTION_ERROR() {
    return 'connection_error';
  }

  /**
   * Constructs an instance.
   *
   * @param {...*} args Constructor arguments, as described by `InfoError`.
   */
  constructor(...args) {
    super(...args);
  }

  /**
   * Convenient wrapper for `new ApiError('connection_error', ...)`.
   *
   * @param {ApiError} cause Cause of the connection error.
   * @param {string} connectionId Connection ID string.
   * @returns {ApiError} The constructed error.
   */
  static connError(cause, connectionId) {
    ApiError.check(cause);
    TString.check(connectionId);

    return new ApiError(cause, ApiError.CONNECTION_ERROR, connectionId);
  }

  /**
   * Returns an indication of whether or not this instance is a
   * connection-related error.
   *
   * @returns {boolean} `true` iff this instance is a connection-related error.
   */
  isConnectionError() {
    return this.name === ApiError.CONNECTION_ERROR;
  }
}
