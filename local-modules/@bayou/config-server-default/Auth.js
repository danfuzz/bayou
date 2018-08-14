// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BearerToken } from '@bayou/api-server';
import { Delay } from '@bayou/promise-util';
import { Errors, UtilityClass } from '@bayou/util-common';

/**
 * {RegEx} Expression that matches properly-formed tokens. The ID and secret
 * portions are each a separate matching group.
 */
const TOKEN_REGEX = /^(tok-[0-9a-f]{16})([0-9a-f]{16})$/;

/**
 * Utility functionality regarding the network configuration of a server.
 */
export default class Auth extends UtilityClass {
  /**
   * {array<BearerToken>} Implementation of standard configuration point.
   *
   * This implementation &mdash; obviously insecurely &mdash; just returns
   * an array with a single token consisting of all zeroes in the numeric
   * portion.
   */
  static get rootTokens() {
    const tokenString = 'tok-00000000000000000000000000000000';

    return Object.freeze([Auth.tokenFromString(tokenString)]);
  }

  /**
   * Implementation of standard configuration point.
   *
   * This implementation requires strings of lowercase hex, of exactly 32
   * characters.
   *
   * @param {string} tokenString The alleged token.
   * @returns {boolean} `true` iff `tokenString` is valid token syntax.
   */
  static isToken(tokenString) {
    return TOKEN_REGEX.test(tokenString);
  }

  /**
   * Implementation of standard configuration point.
   *
   * @param {string} tokenString The token. It is only valid to pass a value for
   *   which {@link #isToken} returns `true`.
   * @returns {BearerToken} An appropriately-constructed instance.
   */
  static tokenFromString(tokenString) {
    return new BearerToken(Auth.tokenId(tokenString), tokenString);
  }

  /**
   * Implementation of standard configuration point.
   *
   * This implementation just returns the first 16 characters of the given
   * string.
   *
   * @param {string} tokenString The token.
   * @returns {string} The ID portion.
   */
  static tokenId(tokenString) {
    const match = tokenString.match(TOKEN_REGEX);

    if (match) {
      // It is a proper token.
      return match[1];
    }

    // **Note:** We redact the value to avoid the likelihood of leaking
    // security-sensitive info.

    if (tokenString.length >= 24) {
      tokenString = `${tokenString.slice(0, 16)}...`;
    } else if (tokenString.length >= 12) {
      tokenString = `${tokenString.slice(0, 8)}...`;
    } else {
      tokenString = '...';
    }

    throw Errors.badValue(tokenString, 'bearer token');
  }

  /**
   * Implementation of standard configuration point.
   *
   * This implementation returns a promise that always resolves after ten
   * minutes, even though this implementation never updates the root tokens.
   * This is done so that the update logic gets excercised in the default
   * configuration.
   *
   * @returns {Promise<true>} Promise that resolves in ten minutes.
   */
  static whenRootTokensChange() {
    const CHANGE_FREQUENCY_MSEC = 10 * 60 * 60 * 1000;
    return Delay.resolve(CHANGE_FREQUENCY_MSEC);
  }
}
