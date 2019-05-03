// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { StoragePath } from '@bayou/file-store-ot';
import { RevisionNumber } from '@bayou/ot-common';
import { TString } from '@bayou/typecheck';
import { FrozenBuffer, InfoError, UtilityClass } from '@bayou/util-common';

/**
 * Utility class for constructing errors salient to this module.
 *
 * **Note:** The names of the methods match the functor names, and because the
 * convention for those is `lowercase_underscore`, that is what's used.
 */
export class Errors extends UtilityClass {
  /**
   * Constructs an error indicating that a content blob was expected to be
   * absent from the file, but turns out to be present.
   *
   * @param {string} hash Hash of the blob in question.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static blobNotAbsent(hash) {
    FrozenBuffer.checkHash(hash);
    return new InfoError('blobNotAbsent', hash);
  }

  /**
   * Constructs an error indicating that a content blob was expected to be
   * present in the file, but turns out to be absent.
   *
   * @param {string} hash Hash of the blob in question.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static blobNotFound(hash) {
    FrozenBuffer.checkHash(hash);
    return new InfoError('blobNotFound', hash);
  }

  /**
   * Constructs an error indicating that a storage path contains data with a
   * different hash than expected.
   *
   * @param {string} storagePath Path in question.
   * @param {string} hash The expected hash.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static pathHashMismatch(storagePath, hash) {
    StoragePath.check(storagePath);
    TString.nonEmpty(hash);
    return new InfoError('pathHashMismatch', storagePath, hash);
  }

  /**
   * Constructs an error indicating that a storage path was expected to be
   * present (that is, not store any data) but turned out to not have data.
   *
   * @param {string} storagePath Path in question.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static pathNotPresent(storagePath) {
    StoragePath.check(storagePath);
    return new InfoError('pathNotPresent', storagePath);
  }

  /**
   * Constructs an error indicating that a storage path was expected to be
   * absent (that is, not store any data) but turned out to have data.
   *
   * @param {string} storagePath Path in question.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static pathNotAbsent(storagePath) {
    StoragePath.check(storagePath);
    return new InfoError('pathNotAbsent', storagePath);
  }

  /**
   * Constructs an error indicating that a storage path was expected to have
   * data but turned out not to.
   *
   * @param {string} storagePath Path in question.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static pathNotFound(storagePath) {
    StoragePath.check(storagePath);
    return new InfoError('pathNotFound', storagePath);
  }

  /**
   * Constructs an error indicating that a file or part was expected to have the
   * indicated revision number, but turns out to have a different one.
   *
   * @param {Int} revNum Revision number in question.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static revNumMismatch(revNum) {
    RevisionNumber.check(revNum);
    return new InfoError('revNumMismatch', revNum);
  }

  /**
   * Indicates whether or not the given error is a `pathHashMismatch`.
   *
   * @param {Error} error Error in question.
   * @returns {boolean} `true` iff it represents a `pathHashMismatch`.
   */
  static is_pathHashMismatch(error) {
    return InfoError.hasName(error, 'pathHashMismatch');
  }

  /**
   * Indicates whether or not the given error is a `pathNotAbsent`.
   *
   * @param {Error} error Error in question.
   * @returns {boolean} `true` iff it represents a `pathNotAbsent`.
   */
  static is_pathNotAbsent(error) {
    return InfoError.hasName(error, 'pathNotAbsent');
  }

  /**
   * Indicates whether or not the given error is a `pathNotFound`.
   *
   * @param {Error} error Error in question.
   * @returns {boolean} `true` iff it represents a `pathNotFound`.
   */
  static is_pathNotFound(error) {
    return InfoError.hasName(error, 'pathNotFound');
  }
}
