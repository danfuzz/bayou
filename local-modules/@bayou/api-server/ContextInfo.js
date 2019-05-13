// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from '@bayou/codec';
import { CommonBase } from '@bayou/util-common';

import { BaseConnection } from './BaseConnection';
import { BaseTokenAuthorizer } from './BaseTokenAuthorizer';
import { Context } from './Context';

/**
 * All the info needed to construct instances of {@link Context}, except for
 * logging-related stuff (which tends to be different for every instance).
 */
export class ContextInfo extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Codec} codec Codec to use for all connections / sessions.
   * @param {BaseTokenAuthorizer|null} [tokenAuthorizer = null] Optional
   *   authorizer for bearer tokens. If non-`null`, this is used to map bearer
   *   tokens into usable target objects.
   */
  constructor(codec, tokenAuthorizer = null) {
    super();

    /** {Codec} The codec to use for connections / sessions. */
    this._codec = Codec.check(codec);

    /**
     * {BaseTokenAuthorizer|null} If non-`null`, authorizer to use in order to
     * translate bearer tokens to target objects.
     */
    this._tokenAuthorizer =
      (tokenAuthorizer === null) ? null : BaseTokenAuthorizer.check(tokenAuthorizer);

    Object.freeze(this);
  }

  /** {Codec} The codec to use for connections / sessions. */
  get codec() {
    return this._codec;
  }

  /** {BaseTokenAuthorizer|null} The token authorizer to use. */
  get tokenAuthorizer() {
    return this._tokenAuthorizer;
  }

  /**
   * Makes a new instance of {@link Context} hooked up to the given
   * {@link BaseConnection}, and with this instance as its `info`.
   *
   * @param {BaseConnection} connection The connection to be associated with.
   * @returns {Context} An appropriately-constructed instance.
   */
  makeContext(connection) {
    BaseConnection.check(connection);

    return new Context(this, connection);
  }
}
