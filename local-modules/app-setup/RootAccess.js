// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { SplitKey } from 'api-common';
import { BearerToken, Connection, Context } from 'api-server';
import { DocForAuthor, DocServer } from 'doc-server';
import { SeeAll } from 'see-all';
import { TString } from 'typecheck';

/** Logger. */
const log = new SeeAll('root-access');

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
   * @returns {SplitKey} Split token (ID + secret) which provides the requested
   *   access.
   */
  makeAccessKey(authorId, docId) {
    TString.nonempty(authorId);
    TString.nonempty(docId);

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

  /**
   * An object which should be bound to the `auth` API endpoint. This is the
   * old way to do root access. (Yeah, not actually _that_ old.)
   *
   * TODO: Remove this and `_legacyMakeAccessKey()` once `auth` is no longer
   * used (that is, when we consistently use a bearer token in the API message
   * `target` position to perform root auth).
   *
   * @returns {object} Object suitable for binding to `auth`.
   */
  get legacyAuth() {
    return { makeAccessKey: this._legacyMakeAccessKey.bind(this) };
  }

  /**
   * Old version of `makeAccessKey()` which takes an explicit token argument.
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
  _legacyMakeAccessKey(rootCredential, authorId, docId) {
    rootCredential = BearerToken.coerce(rootCredential);
    const target = this._context.getOrNull(rootCredential.id);

    if (target === null) {
      throw new Error('Not authorized.');
    } if (target.target !== this) {
      throw new Error('Not authorized (wrong target).');
    }

    return this.makeAccessKey(authorId, docId);
  }
}
