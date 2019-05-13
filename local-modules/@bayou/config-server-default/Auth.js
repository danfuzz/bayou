// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BearerToken } from '@bayou/api-common';
import { TokenMint } from '@bayou/api-server';
import { BaseAuth } from '@bayou/config-server';
import { TObject, TString } from '@bayou/typecheck';
import { Errors } from '@bayou/util-common';

/**
 * {RegEx} Expression that matches properly-formed tokens. The type, ID, and
 * secret portions are each a separate matching group.
 */
const TOKEN_REGEX = /^(root|autr)-([0-9a-f]{8})-([0-9a-f]{8})$/;

/**
 * {string} ID of the one well-known root token. See {@link #THE_ROOT_TOKEN}
 * for more discussion.
 */
const THE_ROOT_TOKEN_ID = 'root-00000000';

/**
 * {BearerToken} The one well-known root token. This obviously-insecure value is
 * just for this module, the default server configuration module, which is
 * only supposed to be used in development, and not for real production.
 */
const THE_ROOT_TOKEN =
  new BearerToken(THE_ROOT_TOKEN_ID, `${THE_ROOT_TOKEN_ID}-00000000`);

/**
 * {TokenMint} Mint which creates author tokens and also knows about the root
 * token.
 */
const tokenMint = new TokenMint('autr');

// Set up the well-known root token.
tokenMint.registerToken(THE_ROOT_TOKEN, Object.freeze({ type: BaseAuth.TYPE_root }));

/**
 * Utility functionality regarding the network configuration of a server.
 */
export class Auth extends BaseAuth {
  /**
   * {string} Implementation of standard configuration point.
   */
  static get nonTokenPrefix() {
    return 'local-';
  }

  /**
   * {array<BearerToken>} Implementation of standard configuration point.
   *
   * This implementation &mdash; obviously insecurely &mdash; just returns
   * an array with a single token consisting of all zeroes in the numeric
   * portion.
   */
  static get rootTokens() {
    return Object.freeze([THE_ROOT_TOKEN]);
  }

  /**
   * Implementation of standard configuration point.
   *
   * This implementation always returns `[]`, that is, it never makes an cookies
   * required.
   *
   * @param {BearerToken} token The token in question.
   * @returns {array<string>} `[]`, always.
   */
  static async cookieNamesForToken(token) {
    BearerToken.check(token);

    return [];
  }

  /**
   * Implementation of standard configuration point.
   *
   * This implementation succeeds for any valid author ID and always returns a
   * newly-created token. It caches every token token created, such that it can
   * subsequently be found by {@link #getAuthority}.
   *
   * @param {string} authorId ID for the author.
   * @returns {BearerToken} Token which grants author access.
   */
  static async getAuthorToken(authorId) {
    // **Note:** Actually checking for `AuthorId` syntax would introduce a
    // circular dependency. **TODO:** Sort this out.
    TString.check(authorId);

    return tokenMint.mintToken(Object.freeze({
      type: Auth.TYPE_author,
      authorId
    }));
  }

  /**
   * Implementation of standard configuration point.
   *
   * This implementation &mdash; obviously insecurely &mdash; hard-codes a
   * particular token to have "root" authority. See {@link #THE_ROOT_TOKEN},
   * above, for more info.
   *
   * @param {BearerToken} token The token in question.
   * @param {object|null} cookies The cookies needed in order to authorize
   *   `token`, or `null` if no cookies are needed. This value should be based
   * @returns {object} Representation of the authority granted by `token`.
   */
  static async getAuthority(token, cookies) {
    BearerToken.check(token);
    TObject.plainOrNull(cookies);

    const found = tokenMint.getInfoOrNull(token);

    return (found === null) ? { type: Auth.TYPE_none } : found;
  }

  /**
   * Implementation of standard configuration point.
   *
   * This implementation requires strings that have the general form of
   * `<type>-<id>-<secret>`, where `<type>` is four lowercase characters, and
   * the other two parts are each 16 lowercase hexadecimal digits.
   *
   * @param {string} tokenString The alleged token.
   * @returns {boolean} `true` iff `tokenString` is valid token syntax.
   */
  static isToken(tokenString) {
    TString.check(tokenString);
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
    TString.check(tokenString);
    return new BearerToken(Auth.tokenId(tokenString), tokenString);
  }

  /**
   * Implementation of standard configuration point.
   *
   * This implementation returns the type and ID sections (dash-separated).
   *
   * @param {string} tokenString The token.
   * @returns {string} The ID portion.
   */
  static tokenId(tokenString) {
    TString.check(tokenString);
    const match = tokenString.match(TOKEN_REGEX);

    if (match) {
      // It is a proper token.
      return `${match[1]}-${match[2]}`;
    }

    // **Note:** We redact the value to reduce the likelihood of leaking
    // security-sensitive info.
    throw Errors.badValue(BearerToken.redactString(tokenString), 'bearer token');
  }
}
