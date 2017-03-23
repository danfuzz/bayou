// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TObject, TString } from 'typecheck';
import { CommonBase } from 'util-common';

/**
 * Base class for access keys. An access key consists of information for
 * accessing a network-accessible resource, along with functionality for
 * performing authentication. In general, a given instance of this class
 * represents access to a particular resource, but that same resource might also
 * be available via different instances of the class too, and even using
 * different IDs. (That is, it can be a many-to-one relationship.)
 *
 * Instances of this (base) class hold two pieces of information:
 *
 * * A URL at which the resource is available.
 * * The ID of the resource.
 *
 * In addition, subclasses can include additional information.
 *
 * **Note:** The resource ID is _not_ meant to require secrecy in order for
 * the system to be secure. That is, IDs are not required to be unguessable.
 */
export default class BaseKey extends CommonBase {
  /**
   * Checks that a value is an instance of this class. Throws an error if not.
   *
   * @param {*} value Value to check.
   * @returns {BearerToken} `value`.
   */
  static check(value) {
    return TObject.check(value, BaseKey);
  }

  /**
   * Constructs an instance with the indicated parts. Subclasses should override
   * methods as described in the documentation.
   *
   * @param {string} url URL at which the resource may be accessed. This is
   *   expected to be an API endpoint. Alternatively, if this instance will only
   *   ever be used in a context where the URL is implied or superfluous, this
   *   can be passed as `*` (a literal asterisk).
   * @param {string} id Key / resource identifier. This must be a string of at
   *   least 8 characters.
   */
  constructor(url, id) {
    super();

    if (url !== '*') {
      TString.urlAbsolute(url);
    }

    /** {string} URL at which the resource may be accessed, or `*`. */
    this._url = url;

    /** {string} Key / resource identifier. */
    this._id = TString.minLen(id, 8);
  }

  /** {string} URL at which the resource may be accessed, or `*`. */
  get url() {
    return this._url;
  }

  /** {string} Key / resource identifier. */
  get id() {
    return this._id;
  }

  /**
   * Gets a challenge response. This is used as a tactic for two sides of a
   * connection to authenticate each other without ever having to provide a
   * shared secret directly over a connection.
   *
   * @param {string} challenge The challenge. This must be a string which was
   *   previously returned as the `challenge` binding from a call to
   *   `makeChallenge()` (either in this process or any other).
   * @returns {string} The challenge response. It is guaranteed to be at least
   *   16 characters long.
   */
  challengeResponseFor(challenge) {
    TString.minLen(challenge, 16);
    const response = this._impl_challengeResponseFor(challenge);
    return TString.minLen(response, 16);
  }

  /**
   * Main implementation of `challengeResponseFor()`. By default this throws
   * an error ("not implemented"). Subclasses wishing to support challenges
   * must override this to do something else.
   *
   * @param {string} challenge The challenge. It is guaranteed to be a string of
   *   at least 16 characters.
   * @returns {string} The challenge response.
   */
  _impl_challengeResponseFor(challenge) {
    return this._mustOverride(challenge);
  }

  /**
   * Creates a random challenge, to be used for authenticating a peer, and
   * provides both it and the expected response.
   *
   * @returns {object} An object which maps `challenge` to a random challenge
   *   string and `response` to the expected response.
   */
  makeChallengePair() {
    const challenge = this._impl_randomChallengeString();
    const response  = this.challengeResponseFor(challenge);

    TString.minLen(challenge, 16);
    return { challenge, response };
  }

  /**
   * Creates and returns a random challenge string. The returned string must be
   * at least 16 characters long but may be longer. By default this throws an
   * error ("not implemented"). Subclasses wishing to support challenges must
   * override this to do something else.
   *
   * @returns {string} A random challenge string.
   */
  _impl_randomChallengeString() {
    return this._mustOverride();
  }

  /**
   * Gets the printable form of the ID. This defaults to the same as `.id`,
   * but subclasses can override this if they want to produce something
   * different.
   *
   * @returns {string} The printable form of the ID.
   */
  _impl_printableId() {
    return this.id;
  }

  /**
   * Gets the redacted form of this instance.
   *
   * @returns {string} The redacted form.
   */
  toString() {
    const name = this.constructor.API_NAME || this.constructor.name;
    return `{${name} ${this._url} ${this._impl_printableId()}}`;
  }
}
