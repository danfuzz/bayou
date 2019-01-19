// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ProxiedObject } from '@bayou/api-server';
import { Storage } from '@bayou/config-server';
import { CaretId } from '@bayou/doc-common';
import { DocServer } from '@bayou/doc-server';
import { Logger } from '@bayou/see-all';
import { CommonBase, Errors } from '@bayou/util-common';

/** Logger. */
const log = new Logger('author-access');

/**
 * "Author access" object. Each instance of this class corresponds to a
 * particular author (user who is authorized to view and edit documents), and it
 * is through instances of this class that users ultimately exercise that
 * authority.
 */
export default class AuthorAccess extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {string} authorId ID of the author on whose behalf this instance
   *  acts.
   * @param {Context} context_unused The API context that is managed by this
   *   instance, that is, where auth-controlled resources end up getting bound.
   */
  constructor(authorId, context_unused) {
    super();

    /**
     * {string} ID of the author on whose behalf this instance acts. This is
     * only validated syntactically, because full validation requires
     * asynchronous action (e.g., a round trip with the data storage system),
     * and constructors aren't allowed to be `async`.
     */
    this._authorId = Storage.dataStore.checkAuthorIdSyntax(authorId);

    /** {Logger} Logger for this instance. */
    this._log = log.withAddedContext(authorId);

    Object.freeze(this);
  }

  /**
   * Adds a binding to this instance's associated context for the pre-existing
   * editing session for the caret with the indicated ID, on the given document,
   * which must be a caret associated with the author that this instance
   * represents. This method returns `null` if the arguments are valid but do
   * not actually refer to a pre-existing session associated with the author
   * represented by this instance.
   *
   * **TODO:** Context binding ought to happen at a different layer of the
   * system. See comment about this in {@link #makeNewSession} for more details.
   *
   * @param {string} documentId ID of the document which the session is for.
   * @param {string} caretId ID of the caret.
   * @returns {ProxiedObject|null} Proxy wrapper (for return via API) of the
   *   found session, or `null` if the `documentId` is valid but there is no
   *   such pre-existing caret.
   */
  async findExistingSession(documentId, caretId) {
    // We only check the document ID syntax here, because we can count on the
    // call to `getFileComplex()` to do a full validity check as part of its
    // work.
    Storage.dataStore.checkDocumentIdSyntax(documentId);

    CaretId.check(caretId);

    const fileComplex = await DocServer.theOne.getFileComplex(documentId);

    let session;
    try {
      session = await fileComplex.findExistingSession(this._authorId, caretId);
    } catch (e) {
      if (Errors.is_badId(e)) {
        // Per method header doc, this isn't considered a throwable offense.
        return null;
      }
    }

    log.info(
      'Bound session for pre-existing caret.\n',
      `  document: ${documentId}\n`,
      `  author:   ${this._authorId}\n`,
      `  caret:    ${caretId}`);

    // The `ProxiedObject` wrapper tells the API to return this to the far side
    // of the connection as a reference, instead of by encoding its contents.
    return new ProxiedObject(session);
  }

  /**
   * Adds a binding to this instance's associated context for a new editing
   * session on the given document, representing a newly-created caret. If the
   * document doesn't exist, this will cause it to be created.
   *
   * @param {string} documentId ID of the document which the resulting bound
   *   object allows access to.
   * @returns {ProxiedObject} Proxy wrapper (for return via API) of the
   *   newly-created session.
   */
  async makeNewSession(documentId) {
    // We only check the document ID syntax here, because we can count on the
    // call to `getFileComplex()` to do a full validity check as part of its
    // work.
    Storage.dataStore.checkDocumentIdSyntax(documentId);

    const fileComplex = await DocServer.theOne.getFileComplex(documentId);

    // **Note:** This call includes data store back-end validation of the author
    // ID.
    const session = await fileComplex.makeNewSession(this._authorId);

    log.info(
      'Created session for new caret.\n',
      `  document: ${documentId}\n`,
      `  author:   ${this._authorId}\n`,
      `  caret:    ${session.getCaretId()}`);

    // The `ProxiedObject` wrapper tells the API to return this to the far side
    // of the connection as a reference, instead of by encoding its contents.
    return new ProxiedObject(session);
  }
}
