// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BearerToken } from '@bayou/api-common';
import { TString } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

/**
 * Holder for all the information needed to define a user editing session. This
 * class is just a container for the info. See {@link doc-client/DocSession} for
 * usage.
 */
export default class SessionInfo extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {string} serverUrl URL of the server to connect to in order to use
   *   the session.
   * @param {string|BearerToken} authorToken Token which identifies the author
   *   (user) under whose authority the session is to be run. If passed as a
   *   {@link BearerToken}, gets converted to its `secretToken` string.
   * @param {string} documentId ID of the document to be edited in the session.
   * @param {string|null} [caretId = null] ID of a pre-existing caret to control
   *   with the session. If `null`, a new caret will ultimately be created for
   *   the session.
   */
  constructor(serverUrl, authorToken, documentId, caretId = null) {
    super();

    // **TODO:** Consider performing more validation of the arguements. If
    // they're problematic, we'll _eventually_ get errors back from the server,
    // but arguably it's better to know sooner.

    /** {string} URL of the server to connect to in order to use the session. */
    this._serverUrl = TString.urlAbsolute(serverUrl);

    /**
     * {string} Token which identifies the author (user) under whose authority
     * the session is to be run.
     */
    this._authorToken = (authorToken instanceof BearerToken)
      ? authorToken.secretToken
      : TString.check(authorToken);

    /** {string} ID of the document to be edited in the session. */
    this._documentId = TString.check(documentId);

    /**
     * {string|null} ID of a pre-existing caret to control with the session. If
     * `null`, a new caret will ultimately be created for the session.
     */
    this._caretId = TString.orNull(caretId);

    Object.freeze(this);
  }

  /**
   * {string} Token which identifies the author (user) under whose authority
   * the session is to be run.
   */
  get authorToken() {
    return this._authorToken;
  }

  /** {string} ID of the document to be edited in the session. */
  get documentId() {
    return this._documentId;
  }

  /**
   * {string|null} ID of a pre-existing caret to control with the session, if
   * any.
   */
  get caretId() {
    return this._caretId;
  }

  /**
   * {string} Origin-only URL of the server to connect to in order to use the
   * session.
   */
  get serverUrl() {
    return this._serverUrl;
  }

  /**
   * {string} Most-specific log tag to use with this instance. This is the caret
   * ID if non-`null` or otherwise the document ID.
   */
  get logTag() {
    return (this._caretId !== null)
      ? this._caretId
      : this._documentId;
  }

  /**
   * Gets reconstruction arguments for this instance.
   *
   * @returns {array<*>} Reconstruction arguments.
   */
  deconstruct() {
    const most = [this._serverUrl, this._authorToken, this._documentId];

    return (this._caretId === null) ? most : [...most, this._caretId];
  }

  /**
   * Makes an instance just like this one, except with a new value for
   * `authorToken`.
   *
   * @param {string|BearerToken} authorToken New token to use. If passed as a
   *   {@link BearerToken}, gets converted to its `secretToken` string.
   * @returns {SessionInfo} An appropriately-constructed instance.
   */
  withAuthorToken(authorToken) {
    return new SessionInfo(this._serverUrl, authorToken, this._documentId, this._caretId);
  }

  /**
   * Makes an instance just like this one, except with a new value for
   * `caretId`.
   *
   * @param {string} caretId ID of a pre-existing caret to control with the
   *   session.
   * @returns {SessionInfo} An appropriately-constructed instance.
   */
  withCaretId(caretId) {
    TString.check(caretId);
    return new SessionInfo(this._serverUrl, this._authorToken, this._documentId, caretId);
  }

  /**
   * Makes an instance just like this one, except with `null` for `caretId`.
   *
   * @returns {SessionInfo} An appropriately-constructed instance.
   */
  withoutCaretId() {
    return new SessionInfo(this._serverUrl, this._authorToken, this._documentId);
  }
}
