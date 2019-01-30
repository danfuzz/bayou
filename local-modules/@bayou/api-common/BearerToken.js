// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { TString } from '@bayou/typecheck';

import BaseKey from './BaseKey';

/**
 * Bearer token, which is a kind of authentication / authorization key wherein
 * a secret portion is commonly sent directly to a counterparty (as opposed to
 * merely proving that one knows the secret). In this implementation, a bearer
 * token explicitly has a portion which is considered its non-secret ID.
 */
export default class BearerToken extends BaseKey {
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
   * @param {string} id Key / resource identifier. This must be a `TargetId`.
   * @param {string} secretToken Complete token.
   */
  constructor(id, secretToken) {
    super(id);
    TString.check(secretToken);

    /** {string} Secret token. */
    this._secretToken = secretToken;

    Object.freeze(this);
  }

  /**
   * {string} Full secret token. **Note:** It is important to _never_ reveal
   * this value across an unencrypted API boundary or to log it.
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
   * @param {BaseKey|undefined|null} other Instance to compare to.
   * @returns {boolean} `true` iff the two instances are both of this class and
   *   contain the same full secret token value.
   */
  sameToken(other) {
    if ((other === null) || (other === undefined)) {
      return false;
    }

    // It's an error if `other` is not a key, but it's merely a `false` return
    // if `other` isn't an instance of this class.
    BaseKey.check(other);
    if (!(other instanceof BearerToken)) {
      return false;
    }

    return (this.id === other.id) && (this._secretToken === other._secretToken);
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
