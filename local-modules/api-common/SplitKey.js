// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// **Note:** Babel's browser polyfill includes a Node-compatible `crypto`
// module, which is why this is possible to import regardless of environment.
import crypto from 'crypto';

import { TString } from 'typecheck';
import { Random } from 'util-common';

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
   * Converts this instance to codec reconstruction arguments.
   *
   * @returns {array} Reconstruction arguments.
   */
  toCodecArgs() {
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
   * Main implementation of `challengeResponseFor()`, as defined by the
   * superclass.
   *
   * @param {string} challenge The challenge.
   * @returns {string} The challenge response.
   */
  _impl_challengeResponseFor(challenge) {
    TString.hexBytes(challenge, 8, 8);

    const hash = crypto.createHash('sha256');

    hash.update(Buffer.from(challenge, 'hex'));
    hash.update(Buffer.from(this._secret, 'hex'));

    return hash.digest('hex');
  }

  /**
   * Creates and returns a random challenge string, as defined by the
   * superclass. In this case, the result is always an eight byte long hex
   * string (lower case).
   *
   * @returns {string} A random challenge string.
   */
  _impl_randomChallengeString() {
    return Random.hexByteString(8);
  }
}
