// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { AccessKey } from 'api-common';
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
   */
  constructor() {
    /**
     * {Map<string, {key, doc}>} The set of active access keys and associated
     * info, as a map from key ID to access info. `doc` is a `DocForAuthor`
     * instance.
     *
     * **TODO:** Values of the map should have better structure.
     */
    this._accessors = new Map();
  }

  /**
   * Makes an access key which specifically allows access to one document by
   * one author. If the document doesn't exist, this will cause it to be
   * created.
   *
   * @param {*} rootCredential Credential (commonly but not necessarily a
   *   bearer token) which provides "root" access to this server. This method
   *   will throw an error if this value does not correspond to a credential
   *   known to the server.
   * @param {string} authorId ID which corresponds to the author of changes that
   *   are made using the resulting authorization.
   * @param {string} docId ID of the document which the resulting authorization
   *   allows access to.
   * @returns {AccessKey} Split token (ID + secret) which provides the requested
   *   access.
   */
  makeAccessKey(rootCredential, authorId, docId) {
    TString.nonempty(authorId);
    TString.nonempty(docId);

    const validator = Hooks.rootValidator;

    if (!validator.isCredential(rootCredential)) {
      throw new Error('Invalid credential syntax.');
    } else if (!validator.checkCredential(rootCredential)) {
      throw new Error('Not authorized.');
    }

    const docControl = DocServer.THE_INSTANCE.getDoc(docId);
    const doc = new DocForAuthor(docControl, authorId);

    let key = null;
    for (;;) {
      key = AccessKey.randomInstance(`${Hooks.baseUrl}/api`);
      if (this._accessors.get(key.id) === undefined) {
        break;
      }

      // We managed to get an ID collision. Unlikely, but it can happen. So,
      // just iterate and try again.
    }

    this._accessors.set(key.id, {key, doc});

    log.info(`Newly-authorized access.`);
    log.info(`  author: ${authorId}`);
    log.info(`  doc:    ${docId}`);
    log.info(`  key id: ${key.id}`); // The ID is safe to log.

    return key;
  }
}
