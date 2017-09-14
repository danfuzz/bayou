// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseKey } from 'api-common';
import { Hooks } from 'hooks-server';
import { TString } from 'typecheck';
import { Errors } from 'util-common';

/**
 * Bearer token, which is a kind of key which conflates ID and secret.
 * Conflation notwithstanding, some part of a bearer token is always considered
 * to be its "ID." the `hooks-server` value `Hooks.theOne.bearerTokens` can
 * be used to control ID derivation (and general validation) of bearer token
 * strings.
 */
export default class BearerToken extends BaseKey {
  /**
   * Compares two arrays of `BearerToken`s for equality.
   *
   * @param {array<BearerToken>} array1 One array.
   * @param {array<BearerToken>} array2 The other array.
   * @returns {boolean} `true` iff the two arrays contain the same elements in
   *   the same order.
   */
  static sameArrays(array1, array2) {
    if (array1.length !== array2.length) {
      return false;
    }

    for (let i = 0; i < array1.length; i++) {
      const token1 = BearerToken.check(array1[i]);
      if (!token1.sameToken(array2[i])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Constructs an instance with the indicated parts.
   *
   * @param {string} secretToken Complete token. This must be a string of at
   *   least 32 characters.
   */
  constructor(secretToken) {
    TString.minLen(secretToken, 32);

    if (!Hooks.theOne.bearerTokens.isToken(secretToken)) {
      // We don't include any real detail in the error message, as that might
      // inadvertently leak a secret into the logs.
      throw Errors.bad_value('(hidden)', 'secret token');
    }

    super('*', Hooks.theOne.bearerTokens.tokenId(secretToken));

    /** {string} Secret token. */
    this._secretToken = secretToken;

    Object.freeze(this);
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
   * @param {BaseKey|undefined|null} other Instance to compare to.
   * @returns {boolean} `true` iff the two instances are both of this class and
   *   contain the same full secret token value.
   */
  sameToken(other) {
    if ((other === null) || (other === undefined)) {
      return false;
    }

    // It's an error if `other` is not a key, but it's merely a `false` return
    // if `other` isn't an instance of this class.
    BaseKey.check(other);
    if (!(other instanceof BearerToken)) {
      return false;
    }

    return this._secretToken === other._secretToken;
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
   * Main coercion implementation, per the superclass documentation. In this
   * case, `value` must be a string that follows the proper syntax for bearer
   * tokens. If not, this will throw an error.
   *
   * @param {*} value Value to coerce.
   * @returns {BearerToken} `value` as coerced to a `BearerToken`.
   */
  static _impl_coerce(value) {
    return new BearerToken(value);
  }
}
