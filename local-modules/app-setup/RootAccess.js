// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { SplitKey } from 'api-common';
import { Connection, Context } from 'api-server';
import { DocForAuthor, DocServer } from 'doc-server';
import { Logger } from 'see-all';
import { TString } from 'typecheck';

/** Logger. */
const log = new Logger('root-access');

/**
 * "Root access" object. This is the object which is protected by the root
 * bearer token(s) returned via the related `hooks-server` hooks.
 */
export default class RootAccess {
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
   * @param {string} authorId ID which corresponds to the author of changes that
   *   are made using the resulting authorization.
   * @param {string} docId ID of the document which the resulting authorization
   *   allows access to.
   * @returns {Promise<SplitKey>} Promise for a split token (ID + secret) which
   *   provides the requested access.
   */
  makeAccessKey(authorId, docId) {
    TString.nonempty(authorId);
    TString.nonempty(docId);

    return DocServer.theOne.getDoc(docId).then((docControl) => {
      const doc = new DocForAuthor(docControl, authorId);

      // Under normal circumstances, this method is called in the context of an
      // active API connection, but it can also be called when debugging, and in
      // that case we just fall back on the catchall `*` for the associated URL.
      const url = Connection.activeNow
        ? `${Connection.activeNow.baseUrl}/api`
        : '*';

      let key = null;
      for (;;) {
        key = SplitKey.randomInstance(url);
        if (!this._context.hasId(key.id)) {
          break;
        }

        // We managed to get an ID collision. Unlikely, but it can happen. So,
        // just iterate and try again.
      }

      this._context.add(key, doc);

      log.info(`Newly-authorized access.`);
      log.info(`  author:  ${authorId}`);
      log.info(`  doc:     ${docId}`);
      log.info(`  key id:  ${key.id}`); // The ID is safe to log (not security-sensitive).
      log.info(`  key url: ${key.url}`);

      return key;
    });
  }
}
