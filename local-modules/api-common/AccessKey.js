// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import sha256 from 'js-sha256';

import { TInt, TString } from 'typecheck';
import { DataUtil } from 'util-common';

/**
 * A key consisting of two parts, an ID (which is safe to share across the wire
 * without encryption) and a shared secret (which is not safe for unencrypted
 * transport and should even be treated gingerly when encrypted). Instances of
 * this class are used to effect authentication over API connections. In
 * general, a given instance of this class represents access to a particular
 * resource, but that same resource might also be available via different
 * instances of the class too. (That is, it can be a many-to-one relationship.)
 *
 * **TODO:** An `AccessKey` should also contain the URL at which the resource
 * is located. That is, it should contain _all_ the info needed to access a
 * resource.
 */
export default class AccessKey {
  /**
   * Constructs an instance with random parts.
   *
   * @returns {AccessKey} The constructed instance.
   */
  static randomInstance() {
    const id = DataUtil.hexFromBytes(AccessKey._randomByteArray(8));
    const secret = DataUtil.hexFromBytes(AccessKey._randomByteArray(16));
    return new AccessKey(id, secret);
  }

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

  /** Name of this class in the API. */
  static get API_NAME() {
    return 'AccessKey';
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._id, this._secret];
  }

  /**
   * Constructs an instance from API arguments.
   *
   * @param {string} id Same as with the regular constructor.
   * @param {string} secret Same as with the regular constructor.
   * @returns {AccessKey} The constructed instance.
   */
  static fromApi(id, secret) {
    return new AccessKey(id, secret);
  }

  /** {string} Key / resource identifier. */
  get id() {
    return this._id;
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
    const bytes = AccessKey._randomByteArray(8);

    const id        = this._id;
    const challenge = DataUtil.hexFromBytes(bytes);
    const response  = this.challengeResponseFor(challenge);
    return {id, challenge, response};
  }

  /**
   * Returns an array of random bytes, of a given length.
   *
   * @param {Int} length Desired length.
   * @returns {Array<Int>} Array of `length` random bytes.
   */
  static _randomByteArray(length) {
    TInt.min(length, 0);

    const result = [];

    for (let i = 0; i < length; i++) {
      result.push(Math.floor(Math.random() * 256));
    }

    return result;
  }
}
