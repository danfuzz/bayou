// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';
import { FrozenBuffer, InfoError, UtilityClass } from 'util-common';

import StoragePath from './StoragePath';

/**
 * Utility class for constructing errors salient to this module.
 *
 * **Note:** The names of the methods match the functor names, and because the
 * convention for those is `lowercase_underscore`, that is what's used.
 */
export default class Errors extends UtilityClass {
  /**
   * Constructs an error indicating that a content blob was expected to be
   * absent from the file, but turns out to be present.
   *
   * @param {string} hash Hash of the blob in question.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static blob_not_absent(hash) {
    FrozenBuffer.checkHash(hash);
    return new InfoError('blob_not_absent', hash);
  }

  /**
   * Constructs an error indicating that a content blob was expected to be
   * present in the file, but turns out to be absent.
   *
   * @param {string} hash Hash of the blob in question.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static blob_not_found(hash) {
    FrozenBuffer.checkHash(hash);
    return new InfoError('blob_not_found', hash);
  }

  /**
   * Constructs an error indicating that a file does not exist.
   *
   * @param {string} id ID of the file.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static file_not_found(id) {
    TString.check(id);
    return new InfoError('file_not_found', id);
  }

  /**
   * Constructs an error indicating that a storage path contains data with a
   * different hash than expected.
   *
   * @param {string} storagePath Path in question.
   * @param {string} hash The expected hash.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static path_hash_mismatch(storagePath, hash) {
    StoragePath.check(storagePath);
    TString.nonEmpty(hash);
    return new InfoError('path_hash_mismatch', storagePath, hash);
  }

  /**
   * Constructs an error indicating that a storage path was expected to be
   * absent (that is, not store any data) but turned out to have data.
   *
   * @param {string} storagePath Path in question.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static path_not_absent(storagePath) {
    StoragePath.check(storagePath);
    return new InfoError('path_not_absent', storagePath);
  }

  /**
   * Constructs an error indicating that a storage path was expected to have
   * data but turned out not to.
   *
   * @param {string} storagePath Path in question.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static path_not_found(storagePath) {
    StoragePath.check(storagePath);
    return new InfoError('path_not_found', storagePath);
  }

  /**
   * Indicates whether or not the given error is a `path_hash_mismatch`.
   *
   * @param {Error} error Error in question.
   * @returns {boolean} `true` iff it represents a `path_hash_mismatch`.
   */
  static isPathHashMismatch(error) {
    return InfoError.hasName(error, 'path_hash_mismatch');
  }

  /**
   * Indicates whether or not the given error is a `path_not_empty`.
   *
   * @param {Error} error Error in question.
   * @returns {boolean} `true` iff it represents a `path_not_empty`.
   */
  static isPathNotEmpty(error) {
    return InfoError.hasName(error, 'path_not_empty');
  }

  /**
   * Indicates whether or not the given error is a `path_not_found`.
   *
   * @param {Error} error Error in question.
   * @returns {boolean} `true` iff it represents a `path_not_found`.
   */
  static isPathNotFound(error) {
    return InfoError.hasName(error, 'path_not_found');
  }
}
