// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BearerToken } from '@bayou/api-common';
import { TFunction, TInt, TString } from '@bayou/typecheck';
import { CommonBase, Errors } from '@bayou/util-common';

/**
 * Returns a function which returns sequential integers. Functions returned by
 * this function are used as the default value for `randomFn` in the
 * {@link TokenMint} constructor.
 *
 * @returns {function} A function as described above.
 */
function sequenceGenerator() {
  let next = 0;

  function sequence() {
    const result = next;

    next++;
    if (next > 0xffffffff) {
      next = 0;
    }

    return result;
  }

  return sequence;
}

/**
 * "Mint" which can be used to generate instances of {@link BearerToken} which
 * all adhere to a partially configurable pattern. Instances keep track of the
 * tokens they've minted, both to prevent reuse of IDs and to allow full
 * validation. This class also provides a method to register tokens created via
 * other means, so as to avoid reusing the IDs of those tokens.
 *
 * The pattern of the full token form used by this class is
 * `<tag>-<id>-<secret>`, where `<tag>` is an arbitrary but fixed string of
 * lowercase characters, and where `<id>` and `<secret>` are both lowercase
 * hexadecimal numbers of configurable length.
 *
 * **Note:** This class is mostly intended for use in a development
 * configuration, but it is possible to use it in a simple production
 * deployment (e.g. one that doesn't need to deal with communicating tokens
 * across multiple back-end machines, nor one that wishes to have tokens be more
 * durable than OS processes).
 */
export class TokenMint extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {string} tag The tag to use on all tokens minted by this instance.
   * @param {Int} [idLength = 8] The length of the ID portion of tokens minted
   *   by this instance, in digits.
   * @param {Int} [secretLength = 8] The length of the secret portion of tokens
   *   minted by this instance, in digits.
   * @param {function|null} [randomFn = null] Function to use to produce
   *   "random" numbers, or `null` to &mdash; predictably but obviously
   *   insecurely &mdash; use a simple sequence. Each call to `randomFn()` is
   *   expected to return a 32-bit integer.
   */
  constructor(tag, idLength = 8, secretLength = 8, randomFn = null) {
    super();

    /** {string} The tag to use on all tokens minted by this instance. */
    this._tag = TString.check(tag);

    /**
     * {Int} The length of the ID portion of tokens minted by this instance, in
     * digits.
     */
    this._idLength = TInt.nonNegative(idLength);

    /**
     * {Int} The length of the secret portion of tokens minted by this instance,
     * in digits.
     */
    this._secretLength = TInt.nonNegative(secretLength);

    /** {function} Function to use to produce "random" numbers. */
    this._randomFn = (randomFn === null)
      ? sequenceGenerator()
      : TFunction.chcekCallable(randomFn);

    /**
     * {Map<string, object>} Map from token IDs to objects which bind `token`
     * (the token instance) and `info` (the arbitrary info associated with the
     * token).
     */
    this._allTokens = new Map();

    Object.freeze(this);
  }

  /**
   * Gets the information associated with the given token. If the token was not
   * minted by or registered to this instance, this returns `null`.
   *
   * @param {BearerToken} token The token in question.
   * @returns {*} The information associated with `token`, or `null` if `token`
   *   is unknown to this instance.
   */
  getInfoOrNull(token) {
    BearerToken.check(token);

    const found = this._allTokens.get(token.id);

    if ((found === undefined) || !found.token.sameToken(token)) {
      return null;
    }

    return found.info;
  }

  /**
   * Indicates whether this instance knows about the indicated token, because it
   * was either minted by or registered to this instance. The check is performed
   * based on the string forms of the tokens, which means it is possible to pass
   * a {@link BearerToken} that (in terms of `===`) wasn't returned by or
   * registered to this instance which will result in a `true` return from this
   * method.
   *
   * @param {BearerToken} token The token in question.
   * @returns {boolean} `true` iff this instance minted `token`.
   */
  hasToken(token) {
    BearerToken.check(token);

    const found = this._allTokens.get(token.id);

    return (found !== undefined) && found.token.sameToken(token);
  }

  /**
   * Mints and returns a new token, optionally associating arbitrary info with
   * it.
   *
   * @param {*} [info = null] Information to associate with the token.
   * @returns {BearerToken} A freshly-generated token.
   */
  mintToken(info = null) {
    const id     = this._randomId();
    const secret = this._hexString(this._secretLength);
    const token  = new BearerToken(id, `${id}-${secret}`);

    this._allTokens.set(id, { info, token });
    return token;
  }

  /**
   * Registers a token which wasn't minted by this instance, optionally
   * associating arbitrary info with it.
   *
   * @param {BearerToken} token The token to register.
   * @param {*} [info = null] Information to associate with `token`.
   */
  registerToken(token, info = null) {
    const already = this._allTokens.get(token.id);

    if (already !== undefined) {
      throw Errors.badUse(`Duplicate token: ${token.safeString}`);
    }

    this._allTokens.set(token.id, { info, token });
  }

  /**
   * Generates a random string of lowercase hexadecimal digits of the given
   * length, using this instance's {@link #_randomFn}.
   *
   * @param {Int} length The desired length.
   * @returns {string} Random string of digits of length `length`.
   */
  _hexString(length) {
    let result = '';

    while (result.length < length) {
      result += this._randomFn().toString(16).padStart(8, '0');
    }

    return result.slice(0, length);
  }

  /**
   * Generates a random ID, including the tag. The result is guaranteed not to
   * correspond to an already-minted token.
   *
   * @returns {string} New randomly-generated ID.
   */
  _randomId() {
    for (;;) {
      const result = `${this._tag}-${this._hexString(this._idLength)}`;

      if (!this._allTokens.has(result)) {
        return result;
      }
    }
  }
}
