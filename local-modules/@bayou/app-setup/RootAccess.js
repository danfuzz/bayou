// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { SplitKey } from '@bayou/api-common';
import { Context, Target } from '@bayou/api-server';
import { Network, Storage } from '@bayou/config-server';
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
   * @param {string} docId ID of the document which the resulting authorization
   *   allows access to.
   * @returns {SplitKey} A split token (ID + secret) which provides the
   *   requested access.
   */
  async makeAccessKey(authorId, docId) {
    // These checks round-trip with the back-end to do full (not just syntactic)
    // validation.
    await Promise.all([
      Storage.dataStore.checkExistingAuthorId(authorId),
      Storage.dataStore.checkExistingDocumentId(docId)
    ]);

    const fileComplex = await DocServer.theOne.getFileComplex(docId);

    const url       = `${Network.baseUrl}/api`;
    const targetId = this._context.randomSplitKeyId();
    const session   = await fileComplex.makeNewSession(authorId);
    const key       = new SplitKey(url, targetId);
    this._context.addTarget(new Target(key, session));

    log.info(
      'Newly-authorized access.\n',
      `  author:  ${authorId}\n`,
      `  doc:     ${docId}\n`,
      `  caret:   ${session.getCaretId()}\n`,
      `  key id:  ${key.printableId}\n`, // This is safe to log (not security-sensitive).
      `  key url: ${key.url}`);

    return key;
  }
}
