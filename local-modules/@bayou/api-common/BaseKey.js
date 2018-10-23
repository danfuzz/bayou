// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { TString } from '@bayou/typecheck';
import { CommonBase, Errors, URL } from '@bayou/util-common';

import TargetId from './TargetId';

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
 * * The ID of the resource. **Note:** The ID is _not_ meant to require secrecy
 *   in order for the system to be secure. That is, IDs are not required to be
 *   unguessable.
 *
 * In addition, subclasses can include additional information.
 *
 *
 */
export default class BaseKey extends CommonBase {
  /**
   * Redacts a string for use in error messages and logging. This is generally
   * done in error-handling code which expects that its string argument _might_
   * be security-sensitive.
   *
   * @param {string} origString The original string.
   * @returns {string} The redacted form.
   */
  static redactString(origString) {
    TString.check(origString);

    if (origString.length >= 24) {
      return `${origString.slice(0, 16)}...`;
    } else if (origString.length >= 12) {
      return `${origString.slice(0, 8)}...`;
    } else {
      return '...';
    }
  }

  /**
   * Constructs an instance with the indicated parts. Subclasses should override
   * methods as described in the documentation.
   *
   * @param {string} url Absolute URL at which the resource may be accessed.
   *   This is expected to be an API endpoint. Alternatively, if this instance
   *   will only ever be used in a context where the URL is implied or
   *   superfluous, this can be passed as `*` (a literal asterisk). This is
   *   _not_ allowed to have URL-level "auth" info (e.g.,
   *   `http://user:pass@example.com/`).
   * @param {string} id Key / resource identifier. This must be a `TargetId`.
   */
  constructor(url, id) {
    super();

    if (url !== '*') {
      TString.urlAbsolute(url);
    }

    /** {string} URL at which the resource may be accessed, or `*`. */
    this._url = url;

    /** {string} Key / resource identifier. */
    this._id = TargetId.check(id);
  }

  /**
   * {string} Base of `url` (that is, the origin without any path). This throws
   * an error if `url` is `*`.
   */
  get baseUrl() {
    if (this._url === '*') {
      throw Errors.badUse('Cannot get base of wildcard URL.');
    }

    return new URL(this._url).origin;
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
   * {string} Printable and security-safe (i.e. redacted if necessary) form of
   * the token. This will include an "ASCII ellipsis" (`...`) if needed, to
   * indicate redaction.
   */
  get safeString() {
    return TString.check(this._impl_safeString());
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
   * Custom inspector function, as called by `util.inspect()`, which returns a
   * string that identifies the class and includes just the URL and ID
   * properties. The main point of this implementation is to make it so that
   * subclasses can define additional properties which are security-sensitive
   * without worrying about those properties ending up in the `inspect()`
   * output. (That is, subclasses don't have to override this method in order to
   * ensure good security hygiene with respect to stringification.)
   *
   * @param {Int} depth_unused Current inspection depth.
   * @param {object} opts Inspection options.
   * @returns {string} The inspection string form of this instance.
   */
  [inspect.custom](depth_unused, opts) {
    const name = this.constructor.name;

    return (opts.depth < 0)
      ? `${name} {...}`
      : `${name} { ${this._url} ${this.id} }`;
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
   * @abstract
   * @returns {string} A random challenge string.
   */
  _impl_randomChallengeString() {
    return this._mustOverride();
  }

  /**
   * Main implementation of {@link #safeString}. Subclasses must provide an
   * implementation of this.
   *
   * @abstract
   * @returns {string} The redacted string form of this instance.
   */
  _impl_safeString() {
    return this._mustOverride();
  }
}
