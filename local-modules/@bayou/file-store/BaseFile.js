// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { StorageId, StoragePath, TransactionSpec, FileChange } from '@bayou/file-store-ot';
import { TBoolean, TInt, TMap, TObject, TSet } from '@bayou/typecheck';
import { CommonBase, Errors, FrozenBuffer } from '@bayou/util-common';
import { RevisionNumber } from '@bayou/ot-common';

import FileId from './FileId';

/**
 * Base class representing access to a particular file. Subclasses must override
 * several methods defined by this class, as indicated in the documentation.
 * Methods to override are all named with the prefix `_impl_`.
 *
 * The model that this class embodies is that a file is a random-access
 * key-value store with keys having a path-like structure and values being
 * arbitrary binary data.
 */
export default class BaseFile extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {string} fileId The ID of the file this instance represents.
   */
  constructor(fileId) {
    super();

    /** {string} The ID of the file that this instance represents. */
    this._id = FileId.check(fileId);
  }

  /** {string} The ID of the file that this instance represents. */
  get id() {
    return this._id;
  }

  /**
   * {Int|null} The maximum value allowed (inclusive) as the duration specified
   * on `timeout` operations in transactions on this instance, or `null` if
   * there is no limit. Out-of-range values are clamped to this limit.
   *
   * @abstract
   */
  get maxTimeoutMsec() {
    return this._mustOverride();
  }

  /**
   * {Int|null} The minimum value allowed (inclusive) as the duration specified
   * on `timeout` operations in transactions on this instance, or `null` if
   * there is no limit. Out-of-range values are clamped to this limit.
   *
   * @abstract
   */
  get minTimeoutMsec() {
    return this._mustOverride();
  }

  /**
   * Clamps a given timeout value (in msec) to be within the range specified
   * by `minTimeoutMsec..maxTimeoutMsec` as defined by this class. As a special
   * case, the string value `'never'` is interpreted the same as
   * `maxTimeoutMsec`. As a double-special case, the value `'never'` is treated
   * as a period of one day if `maxTimeoutMsec` is `null`. It is an error to
   * pass a value less than `0`.
   *
   * @param {Int|'never'} value The millisecond timeout value to clamp.
   * @returns {Int} The clamped value.
   */
  clampTimeoutMsec(value) {
    if (value === 'never') {
      value = this.maxTimeoutMsec;
      return (value === null)
        ? 24 * 60 * 60 * 1000 // One day in msec.
        : value;
    }

    TInt.nonNegative(value);

    const minTimeoutMsec = this.minTimeoutMsec;
    if (minTimeoutMsec !== null) {
      value = Math.max(value, minTimeoutMsec);
    }

    const maxTimeoutMsec = this.maxTimeoutMsec;
    if (maxTimeoutMsec !== null) {
      value = Math.min(value, maxTimeoutMsec);
    }

    return value;
  }

  /**
   * Creates this file if it does not already exist. This does nothing if the
   * file already exists. Immediately after this call returns successfully, the
   * file is guaranteed to exist but might not be empty.
   *
   * **Note:** To erase the contents of a file without deleting the file itself,
   * use the `deleteAll` operation in a transaction.
   */
  async create() {
    await this._impl_create();
  }

  /**
   * Main implementation of `create()`.
   *
   * @abstract
   */
  async _impl_create() {
    this._mustOverride();
  }

  /**
   * Deletes the storage for this file if it exists. This does nothing if the
   * file does not exist. Immediately after this call returns successfully, the
   * file is guaranteed not to exist.
   */
  async delete() {
    await this._impl_delete();
  }

  /**
   * Main implementation of `delete()`.
   *
   * @abstract
   */
  async _impl_delete() {
    this._mustOverride();
  }

  /**
   * Indicates whether or not this file exists in the store. Calling this method
   * will _not_ cause a non-existent file to come into existence.
   *
   * @returns {boolean} `true` iff this file exists.
   */
  async exists() {
    const result = this._impl_exists();

    return TBoolean.check(await result);
  }

  /**
   * Main implementation of `exists()`.
   *
   * @abstract
   * @returns {boolean} `true` iff this file exists.
   */
  async _impl_exists() {
    this._mustOverride();
  }

  /**
   * Performs a transaction, which consists of a set of operations to be
   * executed with respect to a file as an atomic unit. See `TransactionOp` for
   * details about the possible operations and how they are ordered. This
   * method will throw an error if it was not possible to perform the
   * transaction for any reason.
   *
   * The return value from a successful call is an object with the following
   * bindings:
   *
   * * `revNum` &mdash; The revision number of the file which was used to
   *   satisfy the request. This is always the most recent revision possible
   *   given the restrictions defined in the transaction spec (if any). If there
   *   are no restrictions, then this is always the most recent revision at the
   *   instant the transaction was run.
   * * `newRevNum` &mdash; If the transaction spec included any modification
   *   operations, the revision number of the file that resulted from those
   *   modifications.
   * * `data` &mdash; If the transaction spec included any data read operations,
   *   a `Map<string, FrozenBuffer>` from storage ID strings (`StoragePath`s or
   *   content hashes) to the data which was read. **Note:** Even if there was
   *   no data to read (e.g., all read operations were for non-bound paths), as
   *   long as the spec included any read operations, this property will still
   *   be present.
   * * `paths` &mdash; If the transaction spec included any wait or path list
   *   operations, a `Set<string>` of storage paths that resulted from the
   *   operations. **Note:** Even if there were no found paths (e.g., no
   *   operations matched any paths), as long as the spec included any wait or
   *   path list operations, this property will still be present.
   *
   * It is an error to call this method on a file that doesn't exist, in the
   * sense of the `exists()` method. That is, if `exists()` would return
   * `false`, then this method will fail.
   *
   * @param {TransactionSpec} spec Specification for the transaction, that is,
   *   the set of operations to perform.
   * @returns {object} Object with mappings as described above.
   * @throws {InfoError} Thrown if the transaction failed. Errors so thrown
   *   contain details sufficient for programmatic understanding of the issue.
   */
  async transact(spec) {
    TransactionSpec.check(spec);

    const result = await this._impl_transact(spec);
    TObject.withExactKeys(result, ['revNum', 'newRevNum', 'data', 'paths']);

    // Validate and convert the result to be as documented.

    TInt.nonNegative(result.revNum);

    if (result.newRevNum === null) {
      delete result.newRevNum;
    } else {
      TInt.min(result.newRevNum, result.revNum + 1);
    }

    if (spec.hasReadOps()) {
      if (result.data === null) {
        throw Errors.badUse('Improper subclass behavior: Expected non-`null` `data`.');
      }
      try {
        TMap.check(result.data, x => StorageId.check(x), x => FrozenBuffer.check(x));
      } catch (e) {
        // Contextually-appropriate error.
        throw Errors.badUse('Improper subclass behavior: Expected `data` to be a map from `StorageId` to `FrozenBuffer`.');
      }
    } else {
      if (result.data !== null) {
        throw Errors.badUse('Improper subclass behavior: Expected `null` `data`.');
      }
      delete result.data;
    }

    if (spec.hasPathOps()) {
      if (result.paths === null) {
        throw Errors.badUse('Improper subclass behavior: Expected non-`null` `paths`.');
      }
      try {
        TSet.check(result.paths, x => StoragePath.check(x));
      } catch (e) {
        // Contextually-appropriate error.
        throw Errors.badUse('Improper subclass behavior: Expected `paths` to contain `StoragePath`s.');
      }
    } else {
      if (result.paths !== null) {
        throw Errors.badUse('Improper subclass behavior: Expected `null` `paths`.');
      }
      delete result.paths;
    }

    return result;
  }

  /**
   * Appends a new change to the document. On success, this returns `true`.
   *
   * It is an error to call this method on a file that doesn't exist, in the
   * sense of the `exists()` method. That is, if `exists()` would return
   * `false`, then this method will fail.
   *
   * @param {FileChange} fileChange Change to append. Must be an
   *   instance of FileChange.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {boolean} Success flag. `true` indicates that the change was
   *   appended and `false` if revision number indicates a lost append race.
   *   Any other issue will throw an error.
   */
  async appendChange(fileChange, timeoutMsec) {
    FileChange.check(fileChange);

    const result = await this._impl_appendChange(fileChange, timeoutMsec);
    TBoolean.check(result);

    return result;
  }

  /**
   * Gets the instantaneously-current revision number of the portion of the file
   * controlled by this instance. It is an error to call this on an
   * uninitialized document (e.g., when the underlying file is empty).
   *
   * **Note:** Due to the asynchronous nature of the system, the value returned
   * here could be out-of-date by the time it is received by the caller. As
   * such, even when used promptly, it should not be treated as "definitely
   * current" but more like "probably current but possibly just a lower bound."
   *
   * @param {string} storagePath The `revisionNumberPath` storage path to use
   *   to get the "current" revision number.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {Int} The instantaneously-current revision number.
   */
  async currentRevNum(storagePath, timeoutMsec) {
    StoragePath.check(storagePath);

    const result = await this._impl_currentRevNum(storagePath, timeoutMsec);
    FrozenBuffer.check(result);

    return result;
  }

  /**
   * Reads the stored snapshot for this document part, if available.
   *
   * @param {string} storedSnapshotPath The `storedSnapshotPath` storage path
   *   to use to get the stored snapshot.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {FrozenBuffer|null} The frozen buffer of a stored snapshot,
   *   or `null` if no snapshot was ever stored.
   */
  async readStoredSnapshotOrNull(storedSnapshotPath, timeoutMsec) {
    StoragePath.check(storedSnapshotPath);

    const result = await this._impl_readStoredSnapshotOrNull(storedSnapshotPath, timeoutMsec);

    // Validate buffer if not null
    if (result !== null) {
      FrozenBuffer.check(result);
    }

    return result;
  }

  /**
   * Gets a list of existing changes within a given range. The only changes that
   * exist both (a) have a revision number at or less than the
   * `currentRevNum()` and (b) have not been removed due to being ephemeral
   * data that has aged out. If given the same value for both arguments, this
   * method returns an empty array.
   *
   * @param {string} changePathPrefix The path prefix to use to list changes.
   * @param {Int} startInclusive Start change number (inclusive) of changes to
   *   read.
   * @param {Int} endExclusive End change number (exclusive) of changes to read.
   *   Must be `>= startInclusive`.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {array<Int>} Array of the revision numbers of existing changes, in
   *   order by revision number.
   */
  async listChangeRange(changePathPrefix, startInclusive, endExclusive, timeoutMsec) {
    RevisionNumber.check(startInclusive);
    RevisionNumber.min(endExclusive, startInclusive);

    const result = await this._impl_listChangeRange(changePathPrefix, startInclusive, endExclusive, timeoutMsec);

    if (result.paths === null) {
      throw Errors.badUse('Improper subclass behavior: Expected non-`null` `paths`.');
    }
    try {
      TSet.check(result.paths, x => StoragePath.check(x));
    } catch (e) {
      // Contextually-appropriate error.
      throw Errors.badUse('Improper subclass behavior: Expected `paths` to contain `StoragePath`s.');
    }

    return result;
  }

  /**
   * Waits for the given revision number to have been written. It returns only
   * after the change is made. If the change has already been made by the time
   * this method is called, then it returns promptly.
   *
   * **Note:** In unusual circumstances &mdash; in particular, when a document
   * gets re-created or for document parts that don't keep full change history
   * &mdash; and due to the asynchronous nature of the system, it is possible
   * for a change to not be available (e.g. via {@link #getChange}) soon after
   * the result of a call to this method becomes resolved. Calling code should
   * be prepared for that possibility.
   *
   * @param {StoragePath} revNumPath The `revNumPath` storage path
   *   to use to get the revision number.
   * @param {FrozenBuffer} revNumHash Hash of the revision number to wait for.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   */
  async whenRevNum(revNumPath, revNumHash, timeoutMsec) {
    StoragePath.check(revNumPath);
    revNumHash = StorageId.checkOrGetHash(revNumHash);

    await this._impl_whenRevNum(revNumPath, revNumHash, timeoutMsec);

    return;
  }

  /**
   * Main implementation of `transact()`. It is guaranteed to be called with a
   * valid `TransactionSpec`, though the spec may not be sensible in term of the
   * actual requested operations. The return value should contain all of the
   * return properties specified by `transact()`; if a given property is to be
   * absent in the final result, at this layer it should be represented as
   * `null`.
   *
   * @abstract
   * @param {TransactionSpec} spec Same as with `transact()`.
   * @returns {object} Same as with `transact()`, except with `null`s instead of
   *   missing properties.
   */
  async _impl_transact(spec) {
    return this._mustOverride(spec);
  }

  /**
   * Abstract implementation of `appendChange()`.
   * Appends a new change to the document. On success, this returns `true`.
   *
   * It is an error to call this method on a file that doesn't exist, in the
   * sense of the `exists()` method. That is, if `exists()` would return
   * `false`, then this method will fail.
   *
   * Each subclass implements its own version of `appendChange()`.
   *
   * @param {FileChange} fileChange Change to append. Must be an
   *   instance of FileChange.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {boolean} Success flag. `true` indicates that the change was
   *   appended, otherwise will throw an error.
   * @abstract
   */
  async _impl_appendChange(fileChange, timeoutMsec) {
    return this._mustOverride(fileChange, timeoutMsec);
  }

  /**
   * Abstract implementation of `currentRevNum()`.
   *
   * Each subclass implements its own version.
   *
   * @param {string} storagePath The `revisionNumberPath` storage path to use
   *   to get the "current" revision number.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {Int} The instantaneously-current revision number.
   * @abstract
   */
  async _impl_currentRevNum(storagePath, timeoutMsec) {
    return this._mustOverride(storagePath, timeoutMsec);
  }

  /**
   * Abstract implementation of `listChangeRange()`.
   *
   * @param {string} changePathPrefix The path prefix to use to list changes.
   * @param {Int} startInclusive Start change number (inclusive) of changes to
   *   read.
   * @param {Int} endExclusive End change number (exclusive) of changes to read.
   *   Must be `>= startInclusive`.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {array<Int>} Array of the revision numbers of existing changes, in
   *   order by revision number.
   * @abstract
   */
  async _impl_listChangeRange(changePathPrefix, startInclusive, endExclusive, timeoutMsec) {
    return this._mustOverride(changePathPrefix, startInclusive, endExclusive, timeoutMsec);
  }

  /**
   * Abstract implementation of `readStoredSnapshotOrNull()`
   *
   * Each subclass implements its own version.
   *
   * @param {string} storedSnapshotPath The `storedSnapshotPath` storage path
   *   to use to get the stored snapshot.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {FrozenBuffer|null} The frozen buffer of a stored snapshot,
   *   or `null` if no snapshot was ever stored.
   * @abstract
   */
  async _impl_readStoredSnapshotOrNull(storedSnapshotPath, timeoutMsec) {
    return this._mustOverride(storedSnapshotPath, timeoutMsec);
  }

  /**
   * Abstract implementation of `whenRevNum()`
   *
   * Each subclass implements its own version.
   *
   * @param {StoragePath} revNumPath The `revNumPath` storage path
   *   to use to get the revision number.
   * @param {FrozenBuffer} revNumHash Hash of the revision number to wait for.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @abstract
   */
  async _impl_whenRevNum(revNumPath, revNumHash, timeoutMsec) {
    await this._mustOverride(revNumPath, revNumHash, timeoutMsec);

    return;
  }
}
