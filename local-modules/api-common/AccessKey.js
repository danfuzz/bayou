// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import sha256 from 'js-sha256';

import { TString } from 'typecheck';
import { DataUtil } from 'util-common';

/**
 * A key consisting of two parts, an ID (which is safe to share across the wire)
 * and a shared secret (which is not). Instances of this class are used to
 * effect authentication over API connections. In general a given instance of
 * this class represents access to a particular resource, but that same resource
 * might also be available via different instances of the class too. (That is,
 * it can be a many-to-one relationship.)
 */
export default class AccessKey {
  /**
   * Constructs an instance with the indicated parts.
   *
   * @param {string} id Key / resource identifier. This must be a string of 16
   *   hex digits (lower case).
   * @param {string} secret Shared secret. This must be a string of 32 hex
   *   digits (lower case).
   */
  constructor(id, secret) {
    /** {string} Key / resource identifier. */
    this._id = TString.hexBytes(id, 8, 8);

    /** {string} Shared secret. */
    this._secret = TString.hexBytes(secret, 16, 16);

    Object.freeze(this);
  }

  /** {string} Key / resource identifier. */
  get id() {
    return this._id;
  }

  /**
   * {string} Shared secret. **Note:** It is important to _never_ reveal this
   * value across an API boundary or to log it.
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
    const bytes = [];
    for (let i = 0; i < 8; i++) {
      bytes.push(Math.floor(Math.random() * 256));
    }

    const id        = this._id;
    const challenge = DataUtil.hexFromBytes(bytes);
    const response  = this.challengeResponseFor(challenge);

    return {id, challenge, response};
  }
}
