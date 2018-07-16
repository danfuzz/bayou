// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BearerToken } from '@bayou/api-server';
import { Network } from '@bayou/config-server';
import { Delay } from '@bayou/promise-util';
import { CommonBase } from '@bayou/util-common';

/**
 * Base class for and default implementation of
 * {@link @bayou/config-server/Network#bearerTokens}, which notably serves as
 * documentation for the required methods. See
 * {@link @bayou/api-server#BearerToken} for more details.
 */
export default class BearerTokens extends CommonBase {
  /**
   * {array<BearerToken>} Array of bearer tokens which grant root access to the
   * system.
   *
   * The (obviously insecure) default is the array of {@link #exampleTokens}
   * converted to `BearerToken` objects.
   */
  get rootTokens() {
    const tokens = Network.exampleTokens.map(t => new BearerToken(t));

    return Object.freeze(tokens);
  }

  /**
   * Returns `true` iff the `tokenString` is _syntactically_ valid as a bearer
   * token (whether or not it actually grants any access).
   *
   * The default implementation just returns `true`.
   *
   * @param {string} tokenString_unused The alleged token.
   * @returns {boolean} `true` iff `tokenString` is syntactically valid.
   */
  isToken(tokenString_unused) {
    return true;
  }

  /**
   * Returns the printable and security-safe form of the given token string.
   * This should only be passed strings for which {@link #isToken} returns
   * `true`. This is a convenient wrapper around an ultimate call to
   * {@link @bayou/api-server/BearerToken#printableId}.
   *
   * @param {string} tokenString The string form of the token.
   * @returns {string} Its printable and security-safe form.
   */
  printableId(tokenString) {
    return new BearerToken(tokenString).printableId;
  }

  /**
   * Returns the portion of `tokenString` which should be considered its "ID"
   * for the purposes of lookup, logging, etc.
   *
   * The default implementation just returns the first 16 characters of the
   * string.
   *
   * @param {string} tokenString The token.
   * @returns {string} The ID portion.
   */
  tokenId(tokenString) {
    return tokenString.slice(0, 16);
  }

  /**
   * Returns a promise which becomes resolved (to `true`) the next time that
   * the list of `rootTokens` changes, or (on the margin) could conceivably have
   * changed.
   *
   * The default implementation is for the promise to become resolved after
   * ten minutes even though by default the root tokens never get updated, just
   * so that the update logic gets excercised in the default configuration.
   *
   * @returns {Promise<true>} Promise that resolves when the root tokens should
   *   be checked for update.
   */
  whenRootTokensChange() {
    const CHANGE_FREQUENCY_MSEC = 10 * 60 * 60 * 1000;
    return Delay.resolve(CHANGE_FREQUENCY_MSEC);
  }
}
