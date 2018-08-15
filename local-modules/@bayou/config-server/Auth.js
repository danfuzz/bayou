// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { use } from '@bayou/injecty';
import { UtilityClass } from '@bayou/util-common';

/**
 * Authorization-related functionality.
 */
export default class Auth extends UtilityClass {
  /**
   * {array<BearerToken>} Frozen array of bearer tokens which grant root access
   * to the system. The value of this property &mdash; that is, the array it
   * refers to &mdash; may change over time, but the contents of any given array
   * yielded from this property are guaranteed to be frozen.
   *
   * @see #whenRootTokensChange
   */
  static get rootTokens() {
    return use.Auth.rootTokens;
  }

  /**
   * Returns `true` iff the `tokenString` is _syntactically_ valid as a bearer
   * token (whether or not it actually grants any access).
   *
   * @param {string} tokenString The alleged token.
   * @returns {boolean} `true` iff `tokenString` is syntactically valid.
   */
  static isToken(tokenString) {
    return use.Auth.isToken(tokenString);
  }

  /**
   * Constructs a {@link api-server.BearerToken} from the given string. The
   * result is a {@link BearerToken} instance but does _not_ necessarily convey
   * any authority / authorization.
   *
   * @param {string} tokenString The token. It is only valid to pass a value for
   *   which {@link #isToken} returns `true`.
   * @returns {BearerToken} An appropriately-constructed instance.
   */
  static tokenFromString(tokenString) {
    return use.Auth.tokenFromString(tokenString);
  }

  /**
   * Returns the portion of `tokenString` which should be considered its "ID"
   * for the purposes of lookup, logging, etc.
   *
   * @param {string} tokenString The token. It is only valid to pass a value for
   *   which {@link #isToken} returns `true`.
   * @returns {string} The ID portion.
   */
  static tokenId(tokenString) {
    return use.Auth.tokenId(tokenString);
  }

  /**
   * Returns a promise which becomes resolved (to `true`) the next time that
   * the array of {@link #rootTokens} changes, or (on the margin) could
   * _conceivably_ have changed.
   *
   * @returns {Promise<true>} Promise that resolves when {@link #rootTokens}
   *   should be checked for update.
   */
  static whenRootTokensChange() {
    return use.Auth.whenRootTokensChange();
  }
}
