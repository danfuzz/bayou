// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseKey } from 'api-common';
import { Hooks } from 'hooks-server';
import { TObject, TString } from 'typecheck';

/**
 * Bearer token, which is a kind of key which conflates ID and secret.
 * Conflation notwithstanding, some part of a bearer token is always considered
 * to be its "ID." the `hooks-server` value `Hooks.bearerTokens` can
 * be used to control ID derivation (and general validation) of bearer token
 * strings.
 */
export default class BearerToken extends BaseKey {
  /**
   * Checks that a value is an instance of this class. Throws an error if not.
   *
   * @param {*} value Value to check.
   * @returns {BearerToken} `value`.
   */
  static check(value) {
    return TObject.check(value, BearerToken);
  }

  /**
   * Coerces the given value into an instance of this class, if possible. If
   * given an instance of this class, returns that instance. If given a string,
   * attempts to construct an instance from that string; this will fail if the
   * string isn't in an acceptable form.
   *
   * @param {*} value Value to coerce.
   * @returns {BearerToken} `value` or its coercion to a `BearerToken`.
   */
  static coerce(value) {
    return (value instanceof BearerToken) ? value : new BearerToken(value);
  }

  /**
   * Constructs an instance with the indicated parts.
   *
   * @param {string} secretToken Complete token. This must be a string of at
   *   least 32 characters.
   */
  constructor(secretToken) {
    TString.minLen(secretToken, 32);

    if (!Hooks.bearerTokens.isToken(secretToken)) {
      // We don't include any real detail in the error message, as that might
      // inadvertently leak a secret into the logs.
      throw new Error('Invalid `secretToken` string.');
    }

    super('*', Hooks.bearerTokens.tokenId(secretToken));

    /** {string} Secret token. */
    this._secretToken = secretToken;

    Object.freeze(this);
  }

  /**
   * Gets the printable form of the ID. This class adds an "ASCII ellipsis" to
   * the ID, to make it clear that the ID is a redaction of the full token.
   *
   * @returns {string} The printable form of the ID.
   */
  _impl_printableId() {
    return `${this.id}...`;
  }

  /**
   * {string} Full secret token. **Note:** It is important to _never_ reveal
   * this value across an unencrypted API boundary or to log it.
   */
  get secretToken() {
    return this._secretToken;
  }

  /**
   * Compares this instance to another.
   *
   * @param {BearerToken|undefined|null} other Instance to compare to.
   * @returns {boolean} `true` iff the two instances are both of this class and
   *   contain the same full secret token value.
   */
  sameToken(other) {
    if ((other === null) || (other === undefined)) {
      return false;
    }

    BearerToken.check(other);
    return this._token === other._token;
  }
}
