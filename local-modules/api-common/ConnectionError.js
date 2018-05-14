// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from '@bayou/typecheck';
import { InfoError } from '@bayou/util-common';

/**
 * Error class for reporting errors coming from `ApiClient` related to the
 * connection or transport (as opposed to, e.g., being errors being relayed from
 * the far side of an API connection).
 */
export default class ConnectionError extends InfoError {
  /**
   * Constructs an error indicating that the API connection has been closed.
   * This error is reported in response to any API call made when the connection
   * is closed.
   *
   * @param {string} connectionId Connection ID string.
   * @param {string} detail Human-oriented detail message about the problem.
   * @returns {ConnectionError} An appropriately-constructed error.
   */
  static connection_closed(connectionId, detail) {
    TString.check(connectionId);
    TString.check(detail);
    return new ConnectionError('connection_closed', connectionId, detail);
  }

  /**
   * Constructs an error indicating that the API connection is in the process of
   * being closed. This error is reported in response to any API call made when
   * the connection is destined to be closed.
   *
   * @param {string} connectionId Connection ID string.
   * @returns {ConnectionError} An appropriately-constructed error.
   */
  static connection_closing(connectionId) {
    TString.check(connectionId);
    return new ConnectionError('connection_closing', connectionId);
  }

  /**
   * Constructs an error indicating that there was unspecified trouble with the
   * connection (as opposed to, say, an application logic error).
   *
   * @param {string} connectionId Connection ID string.
   * @returns {ConnectionError} An appropriately-constructed error.
   */
  static connection_error(connectionId) {
    TString.check(connectionId);
    return new ConnectionError('connection_error', connectionId);
  }

  /**
   * Constructs an error indicating that the API received a nonsense message of
   * some sort. This is typically indicative of a bug on the far side of the API
   * connection.
   *
   * @param {string} connectionId Connection ID string.
   * @param {string} detail Human-oriented detail message about the problem.
   * @returns {ConnectionError} An appropriately-constructed error.
   */
  static connection_nonsense(connectionId, detail) {
    TString.check(connectionId);
    TString.check(detail);
    return new ConnectionError('connection_nonsense', connectionId, detail);
  }

  /**
   * Constructs an instance.
   *
   * @param {...*} args Constructor arguments, as described by `InfoError`.
   */
  constructor(...args) {
    super(...args);
  }
}
