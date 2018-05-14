// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from '@bayou/typecheck';
import { Singleton } from 'util-common';

import BaseFile from './BaseFile';
import FileId from './FileId';

/**
 * Base class for file storage access. This is, essentially, the filesystem
 * interface when dealing with the high-level "files" of this system. Subclasses
 * must override several methods defined by this class, as indicated in the
 * documentation. Methods to override are all named with the prefix `_impl_`.
 *
 * **Note:** This is a subclass of `Singleton`, that is, the system is set up
 * to only ever expect there to be one file store instance. (Technically, this
 * inheritence relationship allows for the possibility of having singleton
 * instances of several subclasses of this class, but in practice that's not
 * what happens.)
 */
export default class BaseFileStore extends Singleton {
  /**
   * Checks a file ID for validity. Returns regularly (with no value) if all is
   * well, or throws an error if the ID is invalid. Only ever called on a
   * non-empty string.
   *
   * This implementation is a no-op. Subclasses may choose to override this if
   * there is any validation required beyond the syntactic validation of
   * `FileId.check()`.
   *
   * @param {string} fileId_unused The file ID to validate. Only ever passed
   *   as a value that has been validated by `FileId.check()`.
   * @throws {Error} Arbitrary error indicating an invalid file ID.
   */
  async _impl_checkFileId(fileId_unused) {
    // This space intentionally left blank.
  }

  /**
   * Gets the accessor for the file with the given ID. The file need not exist
   * prior to calling this method.
   *
   * @param {string} fileId The ID of the file to access. Must be a valid file
   *   ID as defined by the concrete subclass.
   * @returns {BaseFile} Accessor for the file in question.
   */
  async getFile(fileId) {
    TString.nonEmpty(fileId);
    await this._impl_checkFileId(FileId.check(fileId));
    return BaseFile.check(await this._impl_getFile(fileId));
  }

  /**
   * Main implementation of `getFile()`. Only ever called with a known-valid
   * `fileId`.
   *
   * @abstract
   * @param {string} fileId The ID of the file to access.
   * @returns {BaseFile} Accessor for the file in question.
   */
  async _impl_getFile(fileId) {
    this._mustOverride(fileId);
  }
}
