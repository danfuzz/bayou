// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Context, Target } from '@bayou/api-server';
import { Storage } from '@bayou/config-server';
import { CaretId } from '@bayou/doc-common';
import { DocServer } from '@bayou/doc-server';
import { Logger } from '@bayou/see-all';
import { CommonBase } from '@bayou/util-common';

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
   * @param {Context} context The API context that is managed by this instance,
   *   that is, where auth-controlled resources end up getting bound.
   */
  constructor(authorId, context) {
    super();

    /**
     * {string} ID of the author on whose behalf this instance acts. This is
     * only validated syntactically, because full validation requires
     * asynchronous action (e.g., a round trip with the data storage system),
     * and constructors aren't allowed to be `async`.
     */
    this._authorId = Storage.dataStore.checkAuthorIdSyntax(authorId);

    /** {Context} The API context to use. */
    this._context = Context.check(context);

    /** {Logger} Logger for this instance. */
    this._log = log.withContext(authorId);

    Object.freeze(this);
  }

  /**
   * Adds a binding to this instance's associated context for the pre-existing
   * editing session for the caret with the indicated ID, on the given document,
   * which must be a caret associated with the author that this instance
   * represents. It is an error if the caret (or document) doesn't exist, and it
   * is also an error if the caret exists but is not associated with this
   * instance's author.
   *
   * **TODO:** Context binding ought to happen at a different layer of the
   * system. See comment about this in {@link #makeNewSession} for more details.
   *
   * @param {string} docId ID of the document which the session is for.
   * @param {string} caretId ID of the caret.
   * @returns {string} Target ID within the API context which refers to the
   *   session. This is _not_ the same as the `caretId`.
   */
  async findExistingSession(docId, caretId) {
    // We only check the document ID syntax here, because we can count on the
    // call to `getFileComplex()` to do a full validity check as part of its
    // work.
    Storage.dataStore.checkDocumentIdSyntax(docId);

    CaretId.check(caretId);

    const fileComplex = await DocServer.theOne.getFileComplex(docId);
    const session     = await fileComplex.findExistingSession(this._authorId, caretId);
    const targetId    = this._context.randomId();

    this._context.addTarget(new Target(targetId, session));

    log.info(
      'Bound session for pre-existing caret.\n',
      `  target: ${targetId}\n`,
      `  doc:    ${docId}\n`,
      `  author: ${this._authorId}\n`,
      `  caret:  ${caretId}`);

    return targetId;
  }

  /**
   * Adds a binding to this instance's associated context for a new editing
   * session on the given document, representing a newly-created caret. If the
   * document doesn't exist, this will cause it to be created.
   *
   * **TODO:** Context binding ought to happen at a different layer of the
   * system. Maybe something like: An API method implementation can return an
   * instance of a new class `BindResult` which gets noticed by `api-server`
   * during API dispatch, which causes it to perform binding. This method would
   * then return a session object (`fileComplex.makeNewSession(...)`) wrapped in
   * an instance of that new class. This arrangement would mean that this class
   * won't have to explicitly know about a context, nor even have to worry about
   * generating IDs. Further upstream / parallel simplifications will also be
   * possible, such as (a) a similar change to `RootAccess`, and (b) the
   * possibility of un-exposing `_context` from `Application`.
   *
   * @param {string} docId ID of the document which the resulting bound object
   *   allows access to.
   * @returns {string} Target ID within the API context which refers to the
   *   session. This is _not_ the same as the `caretId`.
   */
  async makeNewSession(docId) {
    // We only check the document ID syntax here, because we can count on the
    // call to `getFileComplex()` to do a full validity check as part of its
    // work.
    Storage.dataStore.checkDocumentIdSyntax(docId);

    const fileComplex = await DocServer.theOne.getFileComplex(docId);
    const targetId    = this._context.randomId();

    // **Note:** This call includes data store back-end validation of the author
    // ID.
    const session = await fileComplex.makeNewSession(this._authorId);

    this._context.addTarget(new Target(targetId, session));

    log.info(
      'Created session for new caret.\n',
      `  target: ${targetId}\n`,
      `  doc:    ${docId}\n`,
      `  author: ${this._authorId}\n`,
      `  caret:  ${session.getCaretId()}`);

    return targetId;
  }
}
