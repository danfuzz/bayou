// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * Class to handle meta-requests.
 */
export default class MetaHandler {
  /**
   * Constructs an instance.
   *
   * @param {string} connectionId The connection ID.
   */
  constructor(connectionId) {
    /** The connection ID. */
    this._connectionId = connectionId;
  }

  /**
   * API meta-method `connectionId`: Returns the connection ID that the server
   * assigned to this connection. This is only meant to be used for logging.
   * For example, it is _not_ guaranteed to be unique.
   *
   * @returns {string} The connection ID.
   */
  connectionId() {
    return this._connectionId;
  }

  /**
   * API meta-method `ping`: No-op method that merely verifies (implicitly) that
   * the connection is working. Always returns `true`.
   *
   * @returns {boolean} `true`, always.
   */
  ping() {
    return true;
  }
}
