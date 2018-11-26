// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

/**
 * Holder for all the information needed to define a user editing session. This
 * class is just a container for the info. See {@link DocSession} for usage.
 */
export default class SessionInfo extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {string} authorToken Token which identifies the author (user) under
   *   whose authority the session is to be run.
   * @param {string} documentId ID of the document to be edited in the session.
   * @param {string|null} [caretId = null] ID of a pre-existing caret to control
   *   with the session. If `null`, a new caret will ultimately be created for
   *   the session.
   */
  constructor(authorToken, documentId, caretId = null) {
    super();

    // **TODO:** Consider performing more validation of the arguements. If
    // they're problematic, we'll _eventually_ get errors back from the server,
    // but arguably it's better to know sooner.

    /**
     * {string} Token which identifies the author (user) under whose authority
     * the session is to be run.
     */
    this._authorToken = TString.check(authorToken);

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
   * Gets reconstruction arguments for this instance.
   *
   * @returns {array<*>} Reconstruction arguments.
   */
  deconstruct() {
    return (this._caretId === null)
      ? [this._authorToken, this._documentId]
      : [this._authorToken, this._documentId, this._caretId];
  }
}
