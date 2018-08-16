// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TokenAuthorizer } from '@bayou/api-server';
import { Auth } from '@bayou/config-server';

/**
 * Application-specific implementation of {@link TokenAuthorizer}.
 *
 * **TODO:** As currently written, this just forwards token parsing onward to
 * the configured {@link Auth} class, but leaves actual authorization as a stub.
 * Eventually, this is where root tokens should get handled, allowing the
 * removal of same from `Application`.
 */
export default class AppAuthorizer extends TokenAuthorizer {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    Object.freeze(this);
  }

  /**
   * @override
   * @param {string} tokenString The alleged token string.
   * @returns {boolean} `true` iff `tokenString` has valid token syntax.
   */
  _impl_isToken(tokenString) {
    return Auth.isToken(tokenString);
  }

  /**
   * @override
   * @param {BearerToken} token_unused Token to look up.
   * @returns {object|null} If `token` grants any authority, an object which
   *   exposes the so-authorized functionality, or `null` if no authority is
   *   granted.
   */
  async _impl_targetFromToken(token_unused) {
    // **TODO:** See class header comment.
    return null;
  }

  /**
   * @override
   * @param {string} tokenString The alleged token string.
   * @returns {BearerToken} An appropriately-constructed instance.
   */
  _impl_tokenFromString(tokenString) {
    return Auth.tokenFromString(tokenString);
  }
}
