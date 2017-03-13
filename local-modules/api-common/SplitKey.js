// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import sha256 from 'js-sha256';

import { TString } from 'typecheck';
import { DataUtil, Random } from 'util-common';

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
   * Constructs an instance with random ID and secret.
   *
   * @param {string} url URL at which the resource may be accessed. This is
   *   expected to be an API endpoint.
   * @returns {SplitKey} The constructed instance.
   */
  static randomInstance(url) {
    const id = Random.hexByteString(8);
    const secret = Random.hexByteString(16);
    return new SplitKey(url, id, secret);
  }

  /**
   * Constructs an instance with the indicated parts.
   *
   * @param {string} url URL at which the resource may be accessed. This is
   *   expected to be an API endpoint.
   * @param {string} id Key / resource identifier. This must be a string of 16
   *   hex digits (lower case).
   * @param {string} secret Shared secret. This must be a string of 32 hex
   *   digits (lower case).
   */
  constructor(url, id, secret) {
    super(url, id);

    /** {string} Shared secret. */
    this._secret = TString.hexBytes(secret, 16, 16);

    Object.freeze(this);
  }

  /** Name of this class in the API. */
  static get API_NAME() {
    return 'SplitKey';
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._url, this._id, this._secret];
  }

  /**
   * Constructs an instance from API arguments.
   *
   * @param {string} url Same as with the regular constructor.
   * @param {string} id Same as with the regular constructor.
   * @param {string} secret Same as with the regular constructor.
   * @returns {SplitKey} The constructed instance.
   */
  static fromApi(url, id, secret) {
    return new SplitKey(url, id, secret);
  }

  /**
   * {string} Shared secret. **Note:** It is important to _never_ reveal this
   * value across an unencrypted API boundary or to log it.
   */
  get secret() {
    return this._secret;
  }

  /**
   * Gets a challenge response. This is used as a tactic for two sides of a
   * connection to authenticate each other without ever having to provide a
   * shared secret directly over a connection.
   *
   * @param {string} challenge Challenge. This must be a string of 16 hex digits
   *   (lower case).
   * @returns {string} The challenge response.
   */
  challengeResponseFor(challenge) {
    TString.hexBytes(challenge, 8, 8);

    const hash = sha256.create();

    hash.update(DataUtil.bytesFromHex(challenge));
    hash.update(DataUtil.bytesFromHex(this._secret));

    return hash.hex();
  }

  /**
   * Creates a random challenge, to be used for authenticating a peer.
   *
   * @returns {object} An object which maps `id` to the key ID, `challenge` to
   *   the challenge string and `response` to the expected response.
   */
  randomChallenge() {
    const id        = this._id;
    const challenge = Random.hexByteString(8);
    const response  = this.challengeResponseFor(challenge);
    return {id, challenge, response};
  }
}
