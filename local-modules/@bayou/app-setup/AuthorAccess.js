// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
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
   */
  constructor(authorId) {
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
    // Basic typechecks as a preflight before doing anything more serious.
    Storage.dataStore.checkDocumentIdSyntax(documentId);
    CaretId.check(caretId);

    const authorId    = this._authorId;
    const { canEdit } = await this._checkIdsAndGetPermissions(documentId);
    const fileComplex = await DocServer.theOne.getFileComplex(documentId);

    let session;
    try {
      session = await fileComplex.findExistingSession(authorId, caretId, canEdit);
    } catch (e) {
      if (Errors.is_badId(e)) {
        // Per method header doc, this isn't considered a throwable offense.
        return null;
      }
    }


    log.event.foundSession({ authorId, documentId, caretId, canEdit });

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
    // Basic typecheck as a preflight before doing anything more serious.
    Storage.dataStore.checkDocumentIdSyntax(documentId);

    const authorId    = this._authorId;
    const { canEdit } = await this._checkIdsAndGetPermissions(documentId);
    const fileComplex = await DocServer.theOne.getFileComplex(documentId);
    const session     = await fileComplex.makeNewSession(authorId, canEdit);
    const caretId     = session.getCaretId();

    log.event.madeSession({ authorId, documentId, caretId, canEdit });

    // The `ProxiedObject` wrapper tells the API to return this to the far side
    // of the connection as a reference, instead of by encoding its contents.
    return new ProxiedObject(session);
  }

  /**
   * Helper for {@link #findExistingSession} and {@link #makeNewSession}, which
   * performs full validity checks on the IDs, does a permission check, and, if
   * all is well, returns the permissions in the usual form.
   *
   * @param {string} documentId ID of the document which the session in question
   *   is to access.
   * @returns {object} Ad-hoc permissions object, in the same form as
   *   {@link DataStore#getPermissions}.
   */
  async _checkIdsAndGetPermissions(documentId) {
    const authorId = this._authorId;

    // Ensure (to the extent possible) that both salient IDs are valid the
    // moment before we ask for a permission check. (There is a chance that one
    // or the other could become invalid in the mean time. In those cases, the
    // permission call will properly fail, but nonetheless we're better off
    // trying to get a probably-less-obscure error to happen up front in the
    // usual case.)
    await Promise.all([
      Storage.dataStore.checkExistingAuthorId(authorId),
      Storage.dataStore.checkExistingDocumentId(documentId)
    ]);

    const result = await Storage.dataStore.getPermissions(authorId, documentId);

    if (!(result.canEdit || result.canView)) {
      // Though technically you could say that the file is "found," we report it
      // as a `fileNotFound` to avoid leaking the fact of the file's existence
      // to a user who shouldn't even be able to figure that out.
      throw Errors.fileNotFound(documentId);
    }

    return result;
  }
}
