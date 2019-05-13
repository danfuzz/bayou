// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseTokenAuthorizer } from '@bayou/api-server';
import { Auth } from '@bayou/config-server';

import { Application } from './Application';
import { AuthorAccess } from './AuthorAccess';

/**
 * Application-specific implementation of {@link BaseTokenAuthorizer}. Much of
 * what this class does is hook up to the configured global {@link Auth}.
 */
export class AppAuthorizer extends BaseTokenAuthorizer {
  /**
   * Constructs an instance.
   *
   * @param {Application} application The main application instance that this
   *   instance is associated with.
   */
  constructor(application) {
    super();

    /** {Application} The main application. */
    this._application = Application.check(application);

    Object.freeze(this);
  }

  /**
   * @override
   */
  get _impl_nonTokenPrefix() {
    return Auth.nonTokenPrefix;
  }

  /**
   * @override
   * @param {BearerToken} token The token in question.
   * @returns {array<string>} The names of all the cookies which are needed to
   *   perform validation / authorization on `token`.
   */
  async _impl_cookieNamesForToken(token) {
    return Auth.cookieNamesForToken(token);
  }

  /**
   * @override
   * @param {BearerToken} token Token to look up.
   * @returns {object|null} If `token` grants any authority, an object which
   *   exposes the so-authorized functionality, or `null` if no authority is
   *   granted.
   */
  async _impl_getAuthorizedTarget(token) {
    // **TODO:** `null` below should actually be an object with all the right
    // cookies, if any.
    const authority = await Auth.getAuthority(token, null);

    switch (authority.type) {
      case Auth.TYPE_root: {
        return this._application.rootAccess;
      }

      case Auth.TYPE_author: {
        return new AuthorAccess(authority.authorId);
      }

      default: {
        // No other token types grant authority. (As of this writing, there
        // aren't actually any other token types at all.)
        return null;
      }
    }
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
   * @param {string} tokenString The alleged token string.
   * @returns {BearerToken} An appropriately-constructed instance.
   */
  _impl_tokenFromString(tokenString) {
    return Auth.tokenFromString(tokenString);
  }
}
