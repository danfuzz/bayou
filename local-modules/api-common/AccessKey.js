// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import sha256 from 'js-sha256';

import { TString } from 'typecheck';
import { DataUtil, Random } from 'util-common';

/**
 * Information for accessing a network-accessible resource, along with
 * functionality for performing authentication. In general, a given instance of
 * this class represents access to a particular resource, but that same resource
 * might also be available via different instances of the class too, and even
 * using different IDs. (That is, it can be a many-to-one relationship.)
 *
 * There are three pieces of information held by instances of this class:
 *
 * * A URL at which the resource is available.
 * * The ID of the resource.
 * * A secret key which protects access to the resource.
 *
 * Of the three pieces of info, the first two are safe to pass over an
 * unencrypted connection as well as log, while the last is _not_ safe to pass
 * unencrypted nor to log.
 */
export default class AccessKey {
  /**
   * Constructs an instance with random ID and secret.
   *
   * @param {string} url URL at which the resource may be accessed. This is
   *   expected to be an API endpoint.
   * @returns {AccessKey} The constructed instance.
   */
  static randomInstance(url) {
    const id = Random.hexByteString(8);
    const secret = Random.hexByteString(16);
    return new AccessKey(url, id, secret);
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
    /** {string} URL at which the resource may be accessed. */
    this._url = TString.urlAbsolute(url);

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
    return [this._url, this._id, this._secret];
  }

  /**
   * Constructs an instance from API arguments.
   *
   * @param {string} url Same as with the regular constructor.
   * @param {string} id Same as with the regular constructor.
   * @param {string} secret Same as with the regular constructor.
   * @returns {AccessKey} The constructed instance.
   */
  static fromApi(url, id, secret) {
    return new AccessKey(url, id, secret);
  }

  /** {string} URL at which the resource may be accessed. */
  get url() {
    return this._url;
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
   * Gets the redacted form of this instance.
   *
   * @returns {string} The redacted form.
   */
  toString() {
    return `{${AccessKey.API_NAME} ${this._url} ${this._id}}`;
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
