// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseDocStore } from '@bayou/config-server';
import { DefaultIdSyntax } from '@bayou/id-syntax-default';

/**
 * Data storage implementation that is maximally accepting of IDs (e.g. all
 * authors exist).
 */
export default class LocalDataStore extends BaseDocStore {
  /**
   * Implementation as required by the superclass.
   *
   * @param {string} authorId_unused The ID of the author to query.
   * @returns {object} Information about the author (or would-be author).
   */
  async _impl_getAuthorInfo(authorId_unused) {
    return { valid: true, exists: true };
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {string} documentId The ID of the document to query.
   * @returns {object} Information about the document (or would-be document).
   */
  async _impl_getDocumentInfo(documentId) {
    return { valid: true, exists: true, fileId: documentId };
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {string} authorId_unused The ID of the author.
   * @param {string} documentId_unused The ID of the document.
   * @returns {object} Permission information.
   */
  async _impl_getPermissions(authorId_unused, documentId_unused) {
    return { canEdit: true, canView: true };
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {string} authorId The alleged author ID.
   * @returns {boolean} `true` if `authorId` is a syntactically valid author ID,
   *   or `false` if not.
   */
  _impl_isAuthorId(authorId) {
    return DefaultIdSyntax.isAuthorId(authorId);
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {string} documentId The alleged document ID.
   * @returns {boolean} `true` if `documentId` is a syntactically valid document
   *   ID, or `false` if not.
   */
  _impl_isDocumentId(documentId) {
    return DefaultIdSyntax.isDocumentId(documentId);
  }
}
