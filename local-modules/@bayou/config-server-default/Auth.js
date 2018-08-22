// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BearerToken } from '@bayou/api-common';
import { BaseAuth } from '@bayou/config-server';
import { TInt, TString } from '@bayou/typecheck';
import { Errors } from '@bayou/util-common';

/**
 * {RegEx} Expression that matches properly-formed tokens. The type, ID, and
 * secret portions are each a separate matching group.
 */
const TOKEN_REGEX = /^(root|autr)-([0-9a-f]{16})-([0-9a-f]{16})$/;

/**
 * {string} ID of the one well-known root token. See {@link #THE_ROOT_TOKEN}
 * for more discussion.
 */
const THE_ROOT_TOKEN_ID = 'root-0000000000000000';

/**
 * {string} The one well-known root token. This obviously-insecure arrangement
 * is just for this module, the default server configuration module, which is
 * only supposed to be used in development, not real production.
 */
const THE_ROOT_TOKEN = `${THE_ROOT_TOKEN_ID}-0000000000000000`;

/** {string} Type prefix used for author tokens. */
const AUTHOR_TOKEN_TYPE = 'autr';

/**
 * {Map<string,object>} Map from token ID strings to objects which are suitable
 * as the return value from {@link Auth#tokenAuthority} (see which), with the
 * addition of a binding `token` to hold the actual token object.
 */
const ALL_TOKENS = new Map();

/** {Int} Next ID to assign to a token. */
let nextTokenId = 1;

/**
 * Utility functionality regarding the network configuration of a server.
 */
export default class Auth extends BaseAuth {
  /**
   * {array<BearerToken>} Implementation of standard configuration point.
   *
   * This implementation &mdash; obviously insecurely &mdash; just returns
   * an array with a single token consisting of all zeroes in the numeric
   * portion.
   */
  static get rootTokens() {
    return Object.freeze([Auth.tokenFromString(THE_ROOT_TOKEN)]);
  }

  /**
   * Implementation of standard configuration point.
   *
   * This implementation succeeds for any valid author ID and always returns a
   * newly-created token. It caches every token token created, such that it can
   * subsequently be found by {@link #tokenAuthority}.
   *
   * @param {string} authorId ID for the author.
   * @returns {BearerToken} Token which grants author access.
   */
  static getAuthorToken(authorId) {
    // **Note:** Actually checking for `AuthorId` syntax would introduce a
    // circular dependency. **TODO:** Sort this out.
    TString.check(authorId);

    // **Note:** `^ 1` just so the ID and secret aren't exactly the same.
    const idString = `${AUTHOR_TOKEN_TYPE}-${Auth._hex16(nextTokenId)}`;
    const secretString = Auth._hex16(nextTokenId ^ 1);

    const result = new BearerToken(idString, `${idString}-${secretString}`);

    ALL_TOKENS.set(idString, Object.freeze({
      type:  Auth.TYPE_author,
      token: result,
      authorId
    }));

    nextTokenId++;
    return result;
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
    return TOKEN_REGEX.test(tokenString);
  }

  /**
   * Implementation of standard configuration point.
   *
   * This implementation &mdash; obviously insecurely &mdash; hard-codes a
   * particular token to have "root" authority. See {@link #THE_ROOT_TOKEN},
   * above, for more info.
   *
   * @param {BearerToken} token The token in question.
   * @returns {object} Representation of the authority granted by `token`.
   */
  static async tokenAuthority(token) {
    BearerToken.check(token);

    const found = ALL_TOKENS.get(token.id);

    if ((found === undefined) || !found.token.sameToken(token)) {
      // Either we didn't find a token with a matching ID, or we found such a
      // token, but it has a different secret than `token` has.
      return { type: Auth.TYPE_none };
    }

    // Clone the `found` object, and remove `token` from the clone (as it's not
    // supposed to be returned from this method).

    const result = Object.assign({}, found);
    delete result.token;
    return result;
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
   * This implementation returns the type and ID sections (dash-separated).
   *
   * @param {string} tokenString The token.
   * @returns {string} The ID portion.
   */
  static tokenId(tokenString) {
    const match = tokenString.match(TOKEN_REGEX);

    if (match) {
      // It is a proper token.
      return `${match[1]}-${match[2]}`;
    }

    // **Note:** We redact the value to reduce the likelihood of leaking
    // security-sensitive info.
    throw Errors.badValue(BearerToken.redactString(tokenString), 'bearer token');
  }

  /**
   * Converts the given number into lowercase hexadecimal, left-padded with
   * zeroes.
   *
   * @param {Int} n Number to convert.
   * @returns {string} Sixteen hexadecimal digits.
   */
  static _hex16(n) {
    TInt.check(n);

    return n.toString(16).padStart(16, '0');
  }
}

// Set up the well-known root token.
ALL_TOKENS.set(THE_ROOT_TOKEN_ID, Object.freeze({
  type:  Auth.TYPE_root,
  token: new BearerToken(THE_ROOT_TOKEN_ID, THE_ROOT_TOKEN)
}));
