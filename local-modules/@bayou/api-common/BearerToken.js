// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { TString } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

import { TargetId } from './TargetId';

/**
 * Bearer token, which is a kind of authentication / authorization key wherein
 * a secret portion is commonly sent directly to a counterparty (as opposed to
 * merely proving that one knows the secret). In this implementation, a bearer
 * token explicitly has a portion which is considered its non-secret ID.
 *
 * This implementation does not assume any particular syntax for a full
 * secret-containing token. It merely accepts two constructor arguments, one
 * which is taken to be the non-secret ID, and the other which is the complete
 * token (which should have within it, somehow, both an ID portion and a secret
 * portion).
 */
export class BearerToken extends CommonBase {
  /**
   * Redacts a string for use in error messages and logging. This is generally
   * done in logging and error-handling code which expects that its string
   * argument _might_ be security-sensitive.
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
   * @param {string} id Resource identifier. This must be a `TargetId`.
   * @param {string} secretToken Complete token, which contains a secret.
   */
  constructor(id, secretToken) {
    super();

    /** {string} Resource identifier. */
    this._id = TargetId.check(id);

    /** {string} Complete token, which contains a secret. */
    this._secretToken = TString.check(secretToken);

    /** {string} Logging-safe (redacted) form of the token. */
    this._safeString = BearerToken._redactToken(secretToken, id);

    Object.freeze(this);
  }

  /** {string} Resource identifier. */
  get id() {
    return this._id;
  }

  /**
   * {string} Printable and security-safe (i.e. redacted) form of the token. It
   * includes an "ASCII ellipsis" (`...`) suffix to indicate that it is not the
   * full token value.
   */
  get safeString() {
    return this._safeString;
  }

  /**
   * {string} Complete token, which contains a secret. **Note:** It is important
   * to _never_ reveal this value across an unencrypted API boundary, nor to log
   * it.
   */
  get secretToken() {
    return this._secretToken;
  }

  /**
   * Custom inspector function, as called by `util.inspect()`, which returns a
   * string that identifies the class and includes just the ID. The main point
   * of this is so that casual stringification of instances (which e.g. might
   * get logged) won't leak the secret portion of the instance.
   *
   * @param {Int} depth_unused Current inspection depth.
   * @param {object} opts Inspection options.
   * @returns {string} The inspection string form of this instance.
   */
  [inspect.custom](depth_unused, opts) {
    const name = this.constructor.name;

    return (opts.depth < 0)
      ? `${name} {...}`
      : `${name} { id: ${this.id} }`;
  }

  /**
   * Compares this instance to another.
   *
   * @param {BearerToken|undefined|null} other Instance to compare to.
   * @returns {boolean} `true` iff the two instances are both of this class and
   *   contain the same full secret token value.
   */
  sameToken(other) {
    if ((other === null) || (other === undefined)) {
      return false;
    }

    BearerToken.check(other);

    return (this.id === other.id) && (this._secretToken === other._secretToken);
  }

  /**
   * Produces the redacted form of the given token, by finding the `id` within
   * it and putting `...-` and/or `-...` around it as appropriate, along with
   * reasonable fallback behavior.
   *
   * @param {string} secretToken Complete secret-bearing token.
   * @param {string} id The token ID.
   * @returns {string} The redacted form.
   */
  static _redactToken(secretToken, id) {
    const idAt      = secretToken.indexOf(id);
    const startDots = (idAt > 0);
    const endDots   = (idAt < 0) || ((idAt + id.length) < secretToken.length);

    return `${startDots ? '...-' : ''}${id}${endDots ? '-...' : ''}`;
  }
}
