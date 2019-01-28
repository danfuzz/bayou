// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from '@bayou/codec';
import { CommonBase } from '@bayou/util-common';

import Context from './Context';
import TokenAuthorizer from './TokenAuthorizer';

/**
 * All the info needed to construct instances of {@link Context}, except for
 * logging-related stuff (which tends to be different for every instance).
 */
export default class ContextInfo extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Codec} codec Codec to use for all connections / sessions.
   * @param {TokenAuthorizer|null} [tokenAuthorizer = null] Optional authorizer
   *   for bearer tokens. If non-`null`, this is used to map bearer tokens into
   *   usable target objects.
   */
  constructor(codec, tokenAuthorizer = null) {
    super();

    /** {Codec} The codec to use for connections / sessions. */
    this._codec = Codec.check(codec);

    /**
     * {TokenAuthorizer|null} If non-`null`, authorizer to use in order to
     * translate bearer tokens to target objects.
     */
    this._tokenAuthorizer =
      (tokenAuthorizer === null) ? null : TokenAuthorizer.check(tokenAuthorizer);

    Object.freeze(this);
  }

  /** {Codec} The codec to use for connections / sessions. */
  get codec() {
    return this._codec;
  }

  /** {TokenAuthorizer|null} The token authorizer to use. */
  get tokenAuthorizer() {
    return this._tokenAuthorizer;
  }

  /**
   * Makes a new instance of {@link Context}, with this instance as the `info`
   * and with the given logger.
   *
   * @param {BaseLogger} log The logger to use.
   * @returns {Context} An appropriately-constructed instance.
   */
  makeContext(log) {
    return new Context(this, log);
  }
}
