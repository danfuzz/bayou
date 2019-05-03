// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TBoolean, TObject, TString } from '@bayou/typecheck';
import { CommonBase, Errors } from '@bayou/util-common';

import { BaseFile } from './BaseFile';

/**
 * Base class for file storage access. This is, essentially, the filesystem
 * interface when dealing with the high-level "files" of this system. Subclasses
 * must override several methods defined by this class, as indicated in the
 * documentation. Methods to override are all named with the prefix `_impl_`.
 */
export class BaseFileStore extends CommonBase {
  /**
   * Checks a file ID for full validity, beyond simply checking the syntax of
   * the ID. Returns the given ID if all is well, or throws an error if the ID
   * is invalid.
   *
   * @param {string} fileId The file ID to validate, which must be a
   *   syntactically valid ID, per {@link Storage#isFileId}.
   * @returns {string} `fileId` if it is indeed valid.
   * @throws {Error} `badId` error indicating an invalid file ID.
   */
  async checkFileId(fileId) {
    const info = await this.getFileInfo(fileId);

    if (!info.valid) {
      throw Errors.badId(fileId);
    }

    return fileId;
  }

  /**
   * Checks the syntax of a value alleged to be a file ID. Returns the given
   * value if it's a syntactically correct file ID. Otherwise, throws an error.
   *
   * @param {*} value Value to check.
   * @returns {string} `value` if it is indeed valid.
   * @throws {Error} `badValue` error indicating a syntactically invalid file
   *   ID.
   */
  checkFileIdSyntax(value) {
    if (!this.isFileId(value)) {
      throw Errors.badValue(value, String, 'file ID');
    }

    return value;
  }

  /**
   * Gets the accessor for the file with the given ID. The file need not exist
   * prior to calling this method, but it must be considered "valid" (having the
   * potential to exist).
   *
   * @param {string} fileId The ID of the file to access. Must be a valid file
   *   ID as defined by the concrete subclass.
   * @returns {BaseFile} Accessor for the file in question.
   */
  async getFile(fileId) {
    this.checkFileIdSyntax(fileId);
    await this.checkFileId(fileId);
    return BaseFile.check(await this._impl_getFile(fileId));
  }

  /**
   * Gets information about the indicated file. Given a valid ID &mdash; that
   * is, a string for which {@link Storage#isFileId} returns `true` &mdash; this
   * returns an object with the following bindings:
   *
   * `valid` &mdash; A boolean indicating whether the ID is truly valid with
   *   regard to the storage system. That is, it is possible for `isFileId()` to
   *   return `true` yet this be `false`, because it might only be in the
   *   storage layer that full validity can be determined.
   * `exists` &mdash; A boolean indicating whether or not the file currently
   *   exists.
   *
   * It is an error if the given `fileId` is not a syntactically valid ID, as
   * determined by `isFileId()`.
   *
   * @param {string} fileId The ID of the file.
   * @returns {object} Object with bindings as indicated above, describing the
   *   file (or would-be file) with ID `id`.
   */
  async getFileInfo(fileId) {
    this.checkFileIdSyntax(fileId);

    const result = await this._impl_getFileInfo(fileId);

    TObject.withExactKeys(result, ['exists', 'valid']);
    TBoolean.check(result.exists);
    TBoolean.check(result.valid);

    return result;
  }

  /**
   * Checks a given value to see if it's a syntactically valid file ID. To be a
   * file ID, the value must pass a syntax check defined by the concrete
   * subclass.
   *
   * @param {*} value Value to check.
   * @returns {boolean} `true` if `value` is a syntactically valid file ID, or
   *   `false` if not.
   */
  isFileId(value) {
    TString.check(value);

    return TBoolean.check(this._impl_isFileId(value));
  }

  /**
   * Main implementation of {@link #getFile}. Only ever called with a `fileId`
   * for which {@link #getFileInfo} reports `valid: true`.
   *
   * @abstract
   * @param {string} fileId The ID of the file to access.
   * @returns {BaseFile} Accessor for the file in question.
   */
  async _impl_getFile(fileId) {
    this._mustOverride(fileId);
  }

  /**
   * Main implementation of {@link #getFileInfo}. Only ever called with a
   * syntactically valid `fileId`.
   *
   * @abstract
   * @param {string} fileId The ID of the file to query.
   * @returns {object} Information about the file (or would-be file).
   */
  async _impl_getFileInfo(fileId) {
    this._mustOverride(fileId);
  }

  /**
   * Main implementation of {@link #isFileId}. Only ever called with a string
   * argument.
   *
   * @abstract
   * @param {string} fileId The alleged file ID.
   * @returns {boolean} `true` if `fileId` is a syntactically valid file ID, or
   *   `false` if not.
   */
  _impl_isFileId(fileId) {
    this._mustOverride(fileId);
  }
}
