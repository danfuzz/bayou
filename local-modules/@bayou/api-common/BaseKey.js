// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// **Note:** Babel's browser polyfill includes a Node-compatible `crypto`
// module, which is why this is possible to import regardless of environment.
import crypto from 'crypto';

import { inspect } from 'util';

import { TString } from '@bayou/typecheck';
import { CommonBase, Random } from '@bayou/util-common';

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
 */
export default class BaseKey extends CommonBase {
  /**
   * Constructs an instance with the indicated parts. Subclasses should override
   * methods as described in the documentation.
   *
   * @param {string} id Key / resource identifier. This must be a `TargetId`.
   */
  constructor(id) {
    super();

    /** {string} Key / resource identifier. */
    this._id = TargetId.check(id);
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
   *   {@link #makeChallengePair} (either in this process or any other).
   * @returns {string} The challenge response. It is guaranteed to be at least
   *   16 characters long.
   */
  challengeResponseFor(challenge) {
    TString.hexBytes(challenge, 8, 8);

    const secret = TString.nonEmpty(this._impl_challengeSecret());
    const hash   = crypto.createHash('sha256');

    hash.update(Buffer.from(challenge, 'hex'));
    hash.update(Buffer.from(secret, 'hex'));

    return hash.digest('hex');
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
      : `${name} { ${this.id} }`;
  }

  /**
   * Creates a random challenge, to be used for authenticating a peer, and
   * provides both it and the expected response.
   *
   * @returns {object} An object which maps `challenge` to a random challenge
   *   string and `response` to the expected response.
   */
  makeChallengePair() {
    const challenge = BaseKey._randomChallengeString();
    const response  = this.challengeResponseFor(challenge);

    return { challenge, response };
  }

  /**
   * Value which should be used as the secret for this instance, when
   * constructing a challenge-response pair. Subclasses wishing to support
   * challenges must override this.
   *
   * @abstract
   * @returns {string} The secret to use for challenges. Must be a non-empty
   *   string of hexadecimal digits.
   */
  _impl_challengeSecret() {
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

  /**
   * Creates and returns a random challenge string, as a sequence of hexadecimal
   * digits.
   *
   * @returns {string} A random challenge string.
   */
  static _randomChallengeString() {
    return Random.hexByteString(8);
  }
}
