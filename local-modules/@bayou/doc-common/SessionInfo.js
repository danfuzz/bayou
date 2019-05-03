// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
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
export class SessionInfo extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {string} serverUrl URL of the server to connect to in order to use
   *   the session.
   * @param {string|BearerToken} authorToken Token which identifies the author
   *   (user) under whose authority the session is to be run.
   * @param {string} documentId ID of the document to be edited in the session.
   * @param {string|null} [caretId = null] ID of a pre-existing caret to control
   *   with the session. If `null`, a new caret will ultimately be created for
   *   the session.
   */
  constructor(serverUrl, authorToken, documentId, caretId = null) {
    super();

    // **TODO:** Consider performing more validation of the arguments. If
    // they're problematic, we'll _eventually_ get errors back from the server,
    // but arguably it's better to know sooner.

    /** {string} URL of the server to connect to in order to use the session. */
    this._serverUrl = TString.urlAbsolute(serverUrl);

    /**
     * {string} Token which identifies the author (user) under whose authority
     * the session is to be run.
     */
    this._authorToken = (authorToken instanceof BearerToken) ? authorToken : TString.check(authorToken);

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
   * {object} Ad-hoc object with the contents of this instance, suitable for
   * logging. In particular, the {@link #authorToken} is represented in redacted
   * form.
   */
  get logInfo() {
    const caretId       = this._caretId;
    const token         = this._authorToken;
    const redactedToken = (token instanceof BearerToken)
      ? token.safeString
      : BearerToken.redactString(token);

    const result = {
      serverUrl:   this._serverUrl,
      authorToken: redactedToken,
      documentId:  this._documentId
    };

    if (caretId !== null) {
      result.caretId = caretId;
    }

    return result;
  }

  /**
   * {array<string>} Log tags to use with this instance. The result lists the
   * document ID (always) and the caret ID (if non-`null`).
   */
  get logTags() {
    const documentId = this._documentId;
    const caretId    = this._caretId;

    return (caretId === null) ? [documentId] : [documentId, caretId];
  }

  /**
   * Gets reconstruction arguments for this instance. In deconstructed form,
   * the `authorToken` is always represented as a string.
   *
   * @returns {array<*>} Reconstruction arguments.
   */
  deconstruct() {
    const origToken   = this._authorToken;
    const authorToken = (origToken instanceof BearerToken) ? origToken.secretToken : origToken;
    const maybeCaret  = (this._caretId === null) ? [] : [this._caretId];

    return [this._serverUrl, authorToken, this._documentId, ...maybeCaret];
  }

  /**
   * Makes an instance just like this one, except with a new value for
   * `authorToken`.
   *
   * @param {string|BearerToken} authorToken New token to use.
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
