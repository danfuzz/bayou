// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from '@bayou/typecheck';

import BaseKey from './BaseKey';

/**
 * Bearer token, which is a kind of key where the secret portion is sent
 * directly to a counterparty (as opposed to merely proving that one knows the
 * secret). In this implementation, a bearer token explicitly has a portion
 * which is considered its non-secret ID.
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
   * @param {string} id Key / resource identifier. This must be a `TargetId`.
   * @param {string} secretToken Complete token.
   */
  constructor(id, secretToken) {
    super('*', id);
    TString.check(secretToken);

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

    return (this.id === other.id) && (this._secretToken === other._secretToken);
  }

  /**
   * Implementation as required by the superclass.
   *
   * @returns {string} The secret to use for challenges, as a hex string.
   */
  _impl_challengeSecret() {
    const buf = Buffer.from(this._secretToken, 'utf-8');

    return buf.toString('hex');
  }

  /**
   * Implementation as required by the superclass.
   *
   * @returns {string} The safe string form of this instance.
   */
  _impl_safeString() {
    return `${this.id}-...`;
  }
}
