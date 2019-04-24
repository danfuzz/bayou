// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Deployment } from '@bayou/config-server';
import { CommonBase } from '@bayou/util-common';

import BaseConnection from './BaseConnection';

/**
 * Class to handle meta-requests.
 */
export default class MetaHandler extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {BaseConnection} connection The connection.
   */
  constructor(connection) {
    super();

    /** {BaseConnection} The connection. */
    this._connection = BaseConnection.check(connection);

    Object.freeze(this);
  }

  /**
   * API meta-method `connectionId`: Returns the connection ID that is assigned
   * to this connection. This is only meant to be used for logging. For example,
   * it is _not_ guaranteed to be unique.
   *
   * @returns {string} The connection ID.
   */
  connectionId() {
    return this._connection.connectionId;
  }
  static get _loggingFor_connectionId() {
    return { result: true };
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
  static get _loggingFor_ping() {
    return { result: true };
  }

  /**
   * API meta-method `serverInfo`: Returns safe-for-publication
   * (non-security-sensitive) information about the server that is servicing
   * this connection.
   *
   * @returns {object} Ad-hoc information about the server.
   */
  serverInfo() {
    return Deployment.serverInfo();
  }
  static get _loggingFor_serverInfo() {
    return { result: true };
  }
}
