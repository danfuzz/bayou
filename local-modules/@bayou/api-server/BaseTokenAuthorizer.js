// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BearerToken } from '@bayou/api-common';
import { TArray, TBoolean, TObject, TString } from '@bayou/typecheck';
import { CommonBase, Errors } from '@bayou/util-common';

/**
 * Abstract class for mapping tokens to objects which embody the powers
 * authorized by those tokens.
 */
export class BaseTokenAuthorizer extends CommonBase {
  /**
   * {string} Prefix which when prepended to an arbitrary ID string is
   * guaranteed to result in string for which {@link #isToken} is `false`. This
   * is used by {@link Context} when generating non-token IDs.
   */
  get nonTokenPrefix() {
    return TString.check(this._impl_nonTokenPrefix);
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
  async cookieNamesForToken(token) {
    BearerToken.check(token);

    const result = await this._impl_cookieNamesForToken(token);

    return TArray.check(result, x => TString.check(x));
  }

  /**
   * Indicates whether the given string is in the valid token syntax as used by
   * this class.
   *
   * @param {string} tokenString The alleged token string.
   * @returns {boolean} `true` iff `tokenString` has valid token syntax.
   */
  isToken(tokenString) {
    TString.check(tokenString);

    return TBoolean.check(this._impl_isToken(tokenString));
  }

  /**
   * Given a token in either object or string form, gets a corresponding
   * "target" object which can be used to exercise the authority granted by the
   * token. This method returns `null` if the token does not grant any
   * authority. A non-`null` return value can be used as a target object,
   * suitable for exposing (proxying) on an API connection.
   *
   * **Note:** This is defined to be an `async` method, on the expectation that
   * in a production configuration, it might require network activity (e.g.
   * querying a different service) to make an authorization determination.
   *
   * @param {string|BearerToken} token Token to look up. If given a string, this
   *   method automatically converts it to a {@link BearerToken} via a call to
   *   {@link #tokenFromString}.
   * @returns {object|null} If `token` grants any authority, an object which
   *   exposes the so-authorized functionality, or `null` if no authority is
   *   granted.
   */
  async targetFromToken(token) {
    if (typeof token === 'string') {
      token = this.tokenFromString(token);
    } else {
      BearerToken.check(token);
    }

    const result = await this._impl_targetFromToken(token);

    return TObject.orNull(result);
  }

  /**
   * Constructs a {@link api-server.BearerToken} from the given string. The
   * result is a {@link BearerToken} instance but does _not_ necessarily convey
   * any authority / authorization.
   *
   * @param {string} tokenString The token string. It is only valid to pass a
   *   value for which {@link #isToken} returns `true`.
   * @returns {BearerToken} An appropriately-constructed instance.
   */
  tokenFromString(tokenString) {
    if (!this.isToken(tokenString)) {
      // Redact the token string in the error to avoid leaking
      // security-sensitive information.
      throw Errors.badValue(BearerToken.redactString(tokenString), 'bearer token');
    }

    const result = this._impl_tokenFromString(tokenString);

    return BearerToken.check(result);
  }

  /**
   * {string} Subclass-specific implementation of {@link #nonTokenPrefix}.
   * Subclasses must override this getter.
   *
   * @abstract
   */
  get _impl_nonTokenPrefix() {
    return this._mustOverride();
  }

  /**
   * Subclass-specific implementation of {@link #cookieNamesForToken}.
   * Subclasses must override this method.
   *
   * @abstract
   * @param {BearerToken} token Token in question. Guaranteed to be a valid
   *   {@link BearerToken} instance.
   * @returns {array<string>} Names of all the cookies which `token` requires
   *   for validation.
   */
  async _impl_cookieNamesForToken(token) {
    return this._mustOverride(token);
  }

  /**
   * Subclass-specific implementation of {@link #isToken}. Subclasses must
   * override this method.
   *
   * @abstract
   * @param {string} tokenString The alleged token string.
   * @returns {boolean} `true` iff `tokenString` has valid token syntax.
   */
  _impl_isToken(tokenString) {
    return this._mustOverride(tokenString);
  }

  /**
   * Subclass-specific implementation of {@link #targetFromToken}. Subclasses
   * must override this method.
   *
   * @abstract
   * @param {BearerToken} token Token to look up. Guaranteed to be a valid
   *   {@link BearerToken} instance.
   * @returns {object|null} If `token` grants any authority, an object which
   *   exposes the so-authorized functionality, or `null` if no authority is
   *   granted.
   */
  async _impl_targetFromToken(token) {
    return this._mustOverride(token);
  }

  /**
   * Subclass-specific implementation of {@link #tokenFromString}. Subclasses
   * must override this method.
   *
   * @abstract
   * @param {string} tokenString The alleged token string. It is guaranteed that
   *   this is a string for which {@link #isToken} returned `true`.
   * @returns {BearerToken} An appropriately-constructed instance.
   */
  _impl_tokenFromString(tokenString) {
    return this._mustOverride(tokenString);
  }
}
