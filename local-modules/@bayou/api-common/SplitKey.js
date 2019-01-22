// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from '@bayou/typecheck';
import { Random } from '@bayou/util-common';

import BaseKey from './BaseKey';

/**
 * "Split" key which contains an explicit key ID and separate secret. In
 * addition to the `BaseKey` data, instances of this class also contain a
 * `secret`. This secret is meant to _only_ ever be passed over a secure
 * (encrypted) connection, and even that is to be avoided when feasible. In
 * addition, secrets are _never_ supposed to be logged.
 */
export default class SplitKey extends BaseKey {
  /**
   * Makes and returns a random ID, suitable for use when constructing instances
   * of this class.
   *
   * @returns {string} A random ID.
   */
  static randomId() {
    return Random.hexByteString(8);
  }

  /**
   * Makes and returns a random secret, suitable for use when constructing
   * instances of this class.
   *
   * @returns {string} A random secret.
   */
  static randomSecret() {
    return Random.hexByteString(16);
  }

  /**
   * Constructs an instance with the indicated parts.
   *
   * @param {string} url URL at which the resource may be accessed. This is
   *   expected to be an API endpoint.
   * @param {string} id Key / resource identifier. This must be a string of 16
   *   hex digits (lower case).
   * @param {string|null} [secret = null] Shared secret. This must be a string
   *   of 32 hex digits (lower case). If passed as `null`, a randomly-generated
   *   string will be used.
   */
  constructor(url, id, secret = null) {
    super(url, TString.hexBytes(id, 8, 8));

    /** {string} Shared secret. */
    this._secret = (secret === null)
      ? SplitKey.randomSecret()
      : TString.hexBytes(secret, 16, 16);

    Object.freeze(this);
  }

  /**
   * {string} Shared secret. **Note:** It is important to _never_ reveal this
   * value across an unencrypted API boundary or to log it.
   */
  get secret() {
    return this._secret;
  }

  /**
   * Gets reconstruction arguments for this instance.
   *
   * @returns {array<*>} Reconstruction arguments.
   */
  deconstruct() {
    return [this.url, this.id, this._secret];
  }

  /**
   * Returns a clone of this instance, except with the given URL instead of
   * whatever this instance came with.
   *
   * @param {string} url Replacement URL.
   * @returns {SplitKey} New instance, as described.
   */
  withUrl(url) {
    return new SplitKey(url, this.id, this._secret);
  }

  /**
   * Implementation as required by the superclass.
   *
   * @returns {string} The secret to use for challenges.
   */
  _impl_challengeSecret() {
    return this._secret;
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
