// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { SplitKey } from 'api-common';
import { BearerToken, Connection, Context } from 'api-server';
import { DocForAuthor, DocServer } from 'doc-server';
import { Hooks } from 'hooks-server';
import { SeeAll } from 'see-all';
import { TString } from 'typecheck';

/** Logger. */
const log = new SeeAll('app-auth');

/**
 * Handler for authorization. This is what answers `auth` requests that come in
 * via the API.
 */
export default class Authorizer {
  /**
   * Constructs an instance.
   *
   * @param {Context} context The API context that is managed by this instance,
   *   that is, where auth-controlled resources end up getting bound.
   */
  constructor(context) {
    /** {Context} The API context to use. */
    this._context = Context.check(context);
  }

  /**
   * Makes an access key which specifically allows access to one document by
   * one author. If the document doesn't exist, this will cause it to be
   * created.
   *
   * @param {BearerToken|string} rootCredential Credential (either a
   *   `BearerToken` or a string that can be coerced to same) which provides
   *   "root" access to this server. This method will throw an error if this
   *   value does not correspond to a credential known to the server.
   * @param {string} authorId ID which corresponds to the author of changes that
   *   are made using the resulting authorization.
   * @param {string} docId ID of the document which the resulting authorization
   *   allows access to.
   * @returns {SplitKey} Split token (ID + secret) which provides the requested
   *   access.
   */
  makeAccessKey(rootCredential, authorId, docId) {
    rootCredential = BearerToken.coerce(rootCredential);
    TString.nonempty(authorId);
    TString.nonempty(docId);

    if (!Hooks.bearerTokens.grantsRoot(rootCredential)) {
      throw new Error('Not authorized.');
    }

    const docControl = DocServer.THE_INSTANCE.getDoc(docId);
    const doc = new DocForAuthor(docControl, authorId);
    const baseUrl = Connection.activeNow.baseUrl;

    let key = null;
    for (;;) {
      key = SplitKey.randomInstance(`${baseUrl}/api`);
      if (!this._context.hasId(key.id)) {
        break;
      }

      // We managed to get an ID collision. Unlikely, but it can happen. So,
      // just iterate and try again.
    }

    this._context.add(key, doc);

    log.info(`Newly-authorized access.`);
    log.info(`  author: ${authorId}`);
    log.info(`  doc:    ${docId}`);
    log.info(`  key id: ${key.id}`); // The ID is safe to log.

    return key;
  }
}
