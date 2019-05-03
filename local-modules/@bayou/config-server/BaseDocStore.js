// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TBoolean, TObject, TString } from '@bayou/typecheck';
import { CommonBase, Errors } from '@bayou/util-common';

/**
 * Base class for data storage access. An instance of (a concrete subclass of)
 * this class is responsible for mitigating access to all of the data stored in
 * the underlying system, _except_ for file data (the latter which is managed by
 * the module {@link @bayou/file-store}).
 */
export class BaseDocStore extends CommonBase {
  /**
   * Checks the syntax of a value alleged to be an author ID. Returns the given
   * value if it's a syntactically correct author ID. Otherwise, throws an
   * error.
   *
   * @param {*} value Value to check.
   * @returns {string} `value` if it is indeed valid.
   * @throws {Error} `badValue` error indicating a syntactically invalid author
   *   ID.
   */
  checkAuthorIdSyntax(value) {
    if (!this.isAuthorId(value)) {
      throw Errors.badValue(value, String, 'author ID');
    }

    return value;
  }

  /**
   * Checks the syntax of a value alleged to be a document ID. Returns the given
   * value if it's a syntactically correct document ID. Otherwise, throws an
   * error.
   *
   * @param {*} value Value to check.
   * @returns {string} `value` if it is indeed valid.
   * @throws {Error} `badValue` error indicating a syntactically invalid
   *   document ID.
   */
  checkDocumentIdSyntax(value) {
    if (!this.isDocumentId(value)) {
      throw Errors.badValue(value, String, 'document ID');
    }

    return value;
  }

  /**
   * Checks an author ID for full validity, beyond simply checking the syntax of
   * the ID, including requiring that it corresponds to an existing author.
   * Returns the given ID if all is well, or throws an error if the ID is
   * invalid in some way.
   *
   * @param {string} authorId The author ID to validate, which must be a
   *   syntactically valid ID, per {@link #isAuthorId}.
   * @returns {string} `authorId` if it is indeed valid and corresponds to an
   *   existing author.
   * @throws {Error} `badData` error indicating an invalid author ID.
   */
  async checkExistingAuthorId(authorId) {
    const info = await this.getAuthorInfo(authorId);

    if (!(info.valid && info.exists)) {
      throw Errors.badData(`Nonexistent author: \`${authorId}\``);
    }

    return authorId;
  }

  /**
   * Checks a document ID for full validity, beyond simply checking the syntax
   * of the ID, including requiring that it corresponds to an existing document.
   * Returns the given ID if all is well, or throws an error if the ID is
   * invalid in some way.
   *
   * @param {string} documentId The document ID to validate, which must be a
   *   syntactically valid ID, per {@link #isDocumentId}.
   * @returns {string} `documentId` if it is indeed valid and corresponds to an
   *   existing document.
   * @throws {Error} `badData` error indicating an invalid document ID.
   */
  async checkExistingDocumentId(documentId) {
    const info = await this.getDocumentInfo(documentId);

    if (!(info.valid && info.exists)) {
      throw Errors.badData(`Nonexistent document: \`${documentId}\``);
    }

    return documentId;
  }

  /**
   * Gets information about the indicated author. Given a valid ID &mdash; that
   * is, a string for which {@link #isAuthorId} returns `true` &mdash; this
   * returns an object with the following bindings:
   *
   * * `valid` &mdash; A boolean indicating whether the ID is truly valid with
   *   regard to the storage system. That is, it is possible for `isAuthorId()`
   *   to return `true` yet this be `false`, because it might only be in the
   *   underlying storage layer that full validity can be determined.
   * * `exists` &mdash; A boolean indicating whether or not the author currently
   *   exists in the system.
   *
   * It is an error if the given `authorId` is not a syntactically valid ID, as
   * determined by `isAuthorId()`.
   *
   * @param {string} authorId The ID of the author.
   * @returns {object} Object with bindings as indicated above, describing the
   *   author (or would-be author) with ID `id`.
   */
  async getAuthorInfo(authorId) {
    this.checkAuthorIdSyntax(authorId);

    const result = await this._impl_getAuthorInfo(authorId);

    TObject.withExactKeys(result, ['exists', 'valid']);
    TBoolean.check(result.exists);
    TBoolean.check(result.valid);

    return result;
  }

  /**
   * Gets information about the indicated document. Given a valid ID &mdash;
   * that is, a string for which {@link #isDocumentId} returns `true` &mdash;
   * this returns an object with the following bindings:
   *
   * * `valid` &mdash; A boolean indicating whether the ID is truly valid with
   *   regard to the storage system. That is, it is possible for
   *   `isDocumentId()` to return `true` yet this be `false`, because it might
   *   only be in the underlying storage layer that full validity can be
   *   determined.
   * * `exists` &mdash; A boolean indicating whether or not the document
   *   currently exists in the system.
   * * `fileId` &mdash; If the document exists, the corresponding file ID string
   *   to use when interacting with {@link @bayou/file-store}, or `null` when
   *   `exists === false`.
   *
   * It is an error if the given `documentId` is not a syntactically valid ID,
   * as determined by `isDocumentId()`.
   *
   * @param {string} documentId The ID of the document.
   * @returns {object} Object with bindings as indicated above, describing the
   *   document (or would-be document) with ID `id`.
   */
  async getDocumentInfo(documentId) {
    this.checkDocumentIdSyntax(documentId);

    const result = await this._impl_getDocumentInfo(documentId);

    TObject.withExactKeys(result, ['exists', 'valid', 'fileId']);
    TBoolean.check(result.exists);
    TBoolean.check(result.valid);
    TString.orNull(result.fileId);

    return result;
  }

  /**
   * Gets permission information about the indicated author's access to the
   * indicated document. Given valid IDs, returns an object with mappings from
   * keys to `boolean`s as follows:
   *
   * * `canEdit` &mdash; Whether the author can perform edits on the document.
   *   **Note:** If this is `true` then `canView` will also always be `true` as
   *   well.
   * * `canView` &mdash; Whether the author can view the document.
   *
   * It is an error if either of the given IDs is invalid, as reported by the
   * back end (not just surface syntax).
   *
   * @param {string} authorId The ID of the author.
   * @param {string} documentId The ID of the document.
   * @returns {object} Object with bindings as indicated above.
   */
  async getPermissions(authorId, documentId) {
    this.checkAuthorIdSyntax(authorId);
    this.checkDocumentIdSyntax(documentId);

    const result = await this._impl_getPermissions(authorId, documentId);

    TObject.withExactKeys(result, ['canEdit', 'canView']);
    TBoolean.check(result.canEdit);
    TBoolean.check(result.canView);

    // Check the stated invariant.
    if (result.canEdit && !result.canView) {
      throw Errors.badUse('Incorrect subclass implementation.');
    }

    return result;
  }

  /**
   * Checks a given value to see if it's a syntactically valid author ID. To be
   * an author ID, the value must pass a syntax check defined by the concrete
   * subclass.
   *
   * @param {*} value Value to check.
   * @returns {boolean} `true` if `value` is a syntactically valid author ID,
   *   or `false` if not.
   */
  isAuthorId(value) {
    TString.check(value);

    return TBoolean.check(this._impl_isAuthorId(value));
  }

  /**
   * Checks a given value to see if it's a syntactically valid document ID. To
   * be a document ID, the value must pass a syntax check defined by the
   * concrete subclass.
   *
   * @param {*} value Value to check.
   * @returns {boolean} `true` if `value` is a syntactically valid document ID,
   *   or `false` if not.
   */
  isDocumentId(value) {
    TString.check(value);

    return TBoolean.check(this._impl_isDocumentId(value));
  }

  /**
   * Main implementation of {@link #getAuthorInfo}. Only ever called with a
   * syntactically valid `authorId`.
   *
   * @abstract
   * @param {string} authorId The ID of the author to query.
   * @returns {object} Information about the author (or would-be author).
   */
  async _impl_getAuthorInfo(authorId) {
    this._mustOverride(authorId);
  }

  /**
   * Main implementation of {@link #getDocumentInfo}. Only ever called with a
   * syntactically valid `documentId`.
   *
   * @abstract
   * @param {string} documentId The ID of the document to query.
   * @returns {object} Information about the document (or would-be document).
   */
  async _impl_getDocumentInfo(documentId) {
    this._mustOverride(documentId);
  }

  /**
   * Main implementation of {@link #getPermissions}. Only ever called with
   * syntactically valid IDs.
   *
   * @abstract
   * @param {string} authorId The ID of the author.
   * @param {string} documentId The ID of the document.
   * @returns {object} Permission information.
   */
  async _impl_getPermissions(authorId, documentId) {
    this._mustOverride(authorId, documentId);
  }

  /**
   * Main implementation of {@link #isAuthorId}. Only ever called with a string
   * argument.
   *
   * **Note:** There is a related configuration hook
   * {@link @bayou/config-common/IdSyntax#isAuthorId}, which ends up getting
   * used on the client side as well as on the server side, in code that is more
   * "at arm's length" from the storage layer. It is expected that concrete
   * subclasses will commonly use the same code for that and this. At a minimum,
   * the syntax accepted here ought to be highly overlapping with what ends up
   * defined in that hook.
   *
   * @abstract
   * @param {string} authorId The alleged author ID.
   * @returns {boolean} `true` if `authorId` is a syntactically valid author ID,
   *   or `false` if not.
   */
  _impl_isAuthorId(authorId) {
    this._mustOverride(authorId);
  }

  /**
   * Main implementation of {@link #isDocumentId}. Only ever called with a
   * string argument.
   *
   * **Note:** There is a related configuration hook
   * {@link @bayou/config-common/IdSyntax#isDocumentId}, which ends up getting
   * used on the client side as well as on the server side, in code that is more
   * "at arm's length" from the storage layer. It is expected that concrete
   * subclasses will commonly use the same code for that and this. At a minimum,
   * the syntax accepted here ought to be highly overlapping with what ends up
   * defined in that hook.
   *
   * @abstract
   * @param {string} documentId The alleged document ID.
   * @returns {boolean} `true` if `documentId` is a syntactically valid document
   *   ID, or `false` if not.
   */
  _impl_isDocumentId(documentId) {
    this._mustOverride(documentId);
  }
}
