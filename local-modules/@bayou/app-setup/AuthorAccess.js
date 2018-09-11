// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Context, Target } from '@bayou/api-server';
import { IdSyntax } from '@bayou/config-common';
import { DocumentId } from '@bayou/doc-common';
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
     * {string} authorId ID of the author on whose behalf this instance acts.
     */
    this._authorId = IdSyntax.checkAuthorId(authorId);

    /** {Context} The API context to use. */
    this._context = Context.check(context);

    /** {Logger} Logger for this instance. */
    this._log = log.withContext(authorId);

    Object.freeze(this);
  }

  /**
   * Adds a binding to this instance's associated context for a new editing
   * session on the given document. If the document doesn't exist, this will
   * cause it to be created.
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
   * @returns {string} ID within the API context which refers to the
   *   newly-created session.
   */
  async makeSession(docId) {
    DocumentId.check(docId);

    const fileComplex = await DocServer.theOne.getFileComplex(docId);

    const sessionId = this._context.randomId();
    const session   = fileComplex.makeNewSession(this._authorId, sessionId);
    this._context.addTarget(new Target(sessionId, session));

    log.info(
      'New session.\n',
      `  doc:        ${docId}\n`,
      `  session id: ${sessionId}`);

    return sessionId;
  }
}
