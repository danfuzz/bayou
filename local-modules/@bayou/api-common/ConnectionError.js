// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { TString } from '@bayou/typecheck';
import { InfoError } from '@bayou/util-common';

import { TargetId } from './TargetId';

/**
 * Error class for reporting errors coming from `ApiClient` related to the
 * connection or transport (as opposed to, e.g., being errors being relayed from
 * the far side of an API connection).
 */
export class ConnectionError extends InfoError {
  /**
   * Constructs an error indicating that the API connection has been closed.
   * This error is reported in response to any API call made when the connection
   * is closed.
   *
   * @param {string} connectionId Connection ID string.
   * @param {string} detail Human-oriented detail message about the problem.
   * @returns {ConnectionError} An appropriately-constructed error.
   */
  static connectionClosed(connectionId, detail) {
    TString.check(connectionId);
    TString.check(detail);
    return new ConnectionError('connectionClosed', connectionId, detail);
  }

  /**
   * Constructs an error indicating that the API connection is in the process of
   * being closed. This error is reported in response to any API call made when
   * the connection is destined to be closed.
   *
   * @param {string} connectionId Connection ID string.
   * @returns {ConnectionError} An appropriately-constructed error.
   */
  static connectionClosing(connectionId) {
    TString.check(connectionId);
    return new ConnectionError('connectionClosing', connectionId);
  }

  /**
   * Constructs an error indicating that there was unspecified trouble with the
   * connection (as opposed to, say, an application logic error).
   *
   * @param {string} connectionId Connection ID string.
   * @returns {ConnectionError} An appropriately-constructed error.
   */
  static connectionError(connectionId) {
    TString.check(connectionId);
    return new ConnectionError('connectionError', connectionId);
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
  static connectionNonsense(connectionId, detail) {
    TString.check(connectionId);
    TString.check(detail);
    return new ConnectionError('connectionNonsense', connectionId, detail);
  }

  /**
   * Constructs an error indicating that a particular value could not be
   * encoded for transmission across an API boundary. This is typically
   * indicative of a bug on the local side of the API connection.
   *
   * @param {string} connectionId Connection ID string.
   * @param {*} value Value that was un-encodable.
   * @returns {ConnectionError} An appropriately-constructed error.
   */
  static couldNotEncode(connectionId, value) {
    TString.check(connectionId);

    const valueString = inspect(value);
    return new ConnectionError('couldNotEncode', connectionId, valueString);
  }

  /**
   * Constructs an error indicating that the _local_ side of the API received a
   * target (ID or token) that it didn't already know about.
   *
   * @param {string} connectionId Connection ID string.
   * @param {string|BearerToken} idOrTarget ID or token that identifies the
   *   target in question.
   * @returns {ConnectionError} An appropriately-constructed error.
   */
  static unknownTarget(connectionId, idOrTarget) {
    TString.check(connectionId);
    TargetId.orToken(idOrTarget);
    return new ConnectionError('unknownTarget', connectionId, TargetId.safeString(idOrTarget));
  }
}
