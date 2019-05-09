// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { use } from '@bayou/injecty';

import { BaseAuth } from './BaseAuth';

/**
 * Authorization-related functionality.
 */
export class Auth extends BaseAuth {
  /**
   * {string} Prefix which when prepended to an arbitrary ID string is
   * guaranteed to result in string for which {@link #isToken} is `false`.
   */
  static get nonTokenPrefix() {
    return use.Auth.nonTokenPrefix;
  }

  /**
   * {array<BearerToken>} Frozen array of bearer tokens which grant root access
   * to the system. The value of this property &mdash; that is, the array it
   * refers to &mdash; may change over time, but the contents of any given array
   * yielded from this property are guaranteed to be frozen.
   */
  static get rootTokens() {
    return use.Auth.rootTokens;
  }

  /**
   * Gets the names of any (HTTP-ish) request cookies whose contents are
   * required in order to fully validate / authorize the given token. If the
   * given token does not require any cookies, then this method returns `[]`
   * (that is, an empty array).
   *
   * **Note:** This is defined to be an `async` method, on the expectation that
   * in a production configuration, it might require network activity (e.g.
   * making a request of a different service) to find out what cookie namess are
   * associated with a given token.
   *
   * @param {BearerToken} token The token in question.
   * @returns {array<string>} The names of all the cookies which are needed to
   *   perform validation / authorization on `token`.
   */
  static async cookieNamesForToken(token) {
    return use.Auth.cookieNamesForToken(token);
  }

  /**
   * Gets (makes or finds in a cache) an author token, associated with the
   * indicated author ID. This throws an error if it is not possible to make
   * such a token.
   *
   * **Note:** This is defined to be an `async` method, on the expectation that
   * in a production configuration, it might require network activity (e.g.
   * making a request of a different service) to make a valid token.
   *
   * @param {string} authorId ID for the author, which must be in the syntax
   *   defined by {@link ot-common.AuthorId}.
   * @returns {BearerToken} Token which grants access for the author (user)
   *   whose ID is `authorId`.
   */
  static async getAuthorToken(authorId) {
    return use.Auth.getAuthorToken(authorId);
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
   * Gets the authority / authorization that is granted by the given
   * {@link BearerToken}. The result is a plain object which binds at least
   * `type` to the type of authority. Per type, the following are the other
   * possible bindings:
   *
   * * `Auth.TYPE_none` &mdash; No other bindings. The token doesn't actually
   *   grant any authority.
   * * `Auth.TYPE_root` &mdash; No other bindings. The token is a "root" token,
   *   which grants full system access. (This sort of token is how a trusted
   *   back-end system communicates with this server.)
   * * `Auth.TYPE_author` &mdash; Additional binding `authorId`, a string. The
   *   token is an "author" (user) token, which grants the ability to perform
   *   operations on behalf of the so-identified author. For example, such a
   *   token allows the bearer to edit documents owned by that author.
   *
   * **Note:** This is defined to be an `async` method, on the expectation that
   * in a production configuration, it might require network activity (e.g.
   * querying a different service) to make an authorization determination.
   *
   * **TODO:** Consider having an `expirationTime` binding.
   *
   * @param {BearerToken} token The token in question.
   * @returns {object} Plain object with bindings as described above,
   *   representing the authority granted by `token`.
   */
  static async tokenAuthority(token) {
    return use.Auth.tokenAuthority(token);
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
}
