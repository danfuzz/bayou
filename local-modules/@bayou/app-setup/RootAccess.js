// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { SplitKey } from '@bayou/api-common';
import { Context, Target } from '@bayou/api-server';
import { Auth, Network, Storage } from '@bayou/config-server';
import { SessionInfo } from '@bayou/doc-common';
import { DocServer } from '@bayou/doc-server';
import { Logger } from '@bayou/see-all';
import { CommonBase } from '@bayou/util-common';

/** Logger. */
const log = new Logger('root-access');

/**
 * "Root access" object. This is the object which is protected by the root
 * bearer token(s).
 */
export default class RootAccess extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Context} context The API context that is managed by this instance,
   *   that is, where auth-controlled resources end up getting bound.
   */
  constructor(context) {
    super();

    /** {Context} The API context to use. */
    this._context = Context.check(context);

    Object.freeze(this);
  }

  /**
   * Makes an access key which specifically allows access to one document by
   * one author. If the document doesn't exist, this will cause it to be
   * created.
   *
   * @param {string} authorId ID which corresponds to the author of changes that
   *   are made using the resulting authorization.
   * @param {string} documentId ID of the document which the resulting
   *   authorization allows access to.
   * @returns {SplitKey} A split token (ID + secret) which provides the
   *   requested access.
   */
  async makeAccessKey(authorId, documentId) {
    // These checks round-trip with the back-end to do full (not just syntactic)
    // validation.
    await Promise.all([
      Storage.dataStore.checkExistingAuthorId(authorId),
      Storage.dataStore.checkExistingDocumentId(documentId)
    ]);

    const fileComplex = await DocServer.theOne.getFileComplex(documentId);

    const url      = `${Network.baseUrl}/api`;
    const targetId = this._context.randomSplitKeyId();
    const session  = await fileComplex.makeNewSession(authorId);
    const key      = new SplitKey(url, targetId);
    this._context.addTarget(new Target(key, session));

    // As a "dry run" for the transition to new-style session management, try to
    // get an author token for `authorId`, and log what happens. **TODO:**
    // Remove this -- heck, remove this whole method -- once new-style sessions
    // are consistently used.
    try {
      const authorToken = await Auth.getAuthorToken(authorId);
      const authority   = await Auth.tokenAuthority(authorToken);
      log.event.gotAuthorToken({ where: 'makeAccessKey', token: authorToken.safeString, authority });
    } catch (e) {
      log.event.failedToGetAuthorToken(e);
    }

    log.info(
      'Newly-authorized access.\n',
      `  author:   ${authorId}\n`,
      `  document: ${documentId}\n`,
      `  caret:    ${session.getCaretId()}\n`,
      `  key id:   ${key.safeString}\n`, // This is safe to log (not security-sensitive).
      `  key url:  ${key.url}`);

    return key;
  }

  /**
   * Makes an instance of {@link SessionInfo} which corresponds to a specific
   * author editing a specific document, on the server (or server cluster)
   * running this method.
   *
   * @param {string} authorId ID of the author (user) who will be driving the
   *   session.
   * @param {string} documentId ID of the document to be accessed.
   * @returns {SessionInfo} Corresponding info struct.
   */
  async makeSessionInfo(authorId, documentId) {
    log.event.sessionRequested(authorId, documentId);

    // These checks round-trip with the back-end to do full (not just syntactic)
    // validation.
    await Promise.all([
      Storage.dataStore.checkExistingAuthorId(authorId),
      Storage.dataStore.checkExistingDocumentId(documentId)
    ]);

    // We'll need the file complex as soon as the client becomes active, so
    // might as well warm it up. But also, this ensures that the complex is in
    // at least a semblance of a valid state before we return the info to the
    // caller.
    await DocServer.theOne.getFileComplex(documentId);

    log.event.sessionInfoValid(authorId, documentId);

    const url         = `${Network.baseUrl}/api`;
    const authorToken = await Auth.getAuthorToken(authorId);

    // As a bit of extra visibility / validation as we transition to new-style
    // sessions, get and log the "authority" granted to `authorToken`. This had
    // better turn out to be that it grants edit access to the author in
    // question! **Note:** Only log the safe (redacted) form of the token.
    const authority = await Auth.tokenAuthority(authorToken);
    log.event.gotAuthorToken({ where: 'makeSessionInfo', token: authorToken.safeString, authority });

    // Return the full token string to the caller, as it (the client) will
    // ultimately need to pass it back in full. (Usually it's a bad idea to
    // return unredacted tokens; this (kind of) case is the main exception.)
    return new SessionInfo(url, authorToken, documentId);
  }
}
