// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TBoolean, TInt, TMap, TObject, TString } from 'typecheck';
import { CommonBase, FrozenBuffer } from 'util-common';

import StoragePath from './StoragePath';
import TransactionSpec from './TransactionSpec';

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
    this._id = TString.nonempty(fileId);
  }

  /** {string} The ID of the file that this instance represents. */
  get id() {
    return this._id;
  }

  /**
   * {Int|null} The maximum value allowed (inclusive) as the `timeoutMsec`
   * argument to calls to `whenChange()` on this instance, or `null` if there is
   * no limit. Out-of-range values are clamped to this limit.
   *
   * @abstract
   */
  get maxTimeoutMsec() {
    this._mustOverride();
  }

  /**
   * {Int|null} The minimum value allowed (inclusive) as the `timeoutMsec`
   * argument to calls to `whenChange()` on this instance, or `null` if there is
   * no limit. Out-of-range values are clamped to this limit.
   *
   * @abstract
   */
  get minTimeoutMsec() {
    this._mustOverride();
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
   * file already exists. After this call returns (successfully), the file is
   * guaranteed to exist but might not be empty.
   *
   * **Note:** To erase the contents of a file, use the `deleteAll` operation in
   * a transaction.
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
   * executed with respect to a file as an atomic unit. See `FileOp` for
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
   * * `newRevNum` &mdash; If the transaction spec included any write
   *   operations, the revision number of the file that resulted from those
   *   writes.
   * * `data` &mdash; If the transaction spec included any read operations, a
   *   `Map<string,FrozenBuffer>` from storage paths to the data which was read.
   *   **Note:** Even if there was no data to read (e.g., all read operations
   *   were for non-bound paths) as long as the spec included read operations,
   *   this property will still be present.
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
    TObject.withExactKeys(result, ['revNum', 'newRevNum', 'data']);

    // Validate and convert the result to be as documented.

    TInt.nonNegative(result.revNum);

    if (result.newRevNum === null) {
      delete result.newRevNum;
    } else {
      TInt.min(result.newRevNum, result.revNum + 1);
    }

    if (result.data === null) {
      delete result.data;
    } else {
      TMap.check(result.data, TString.check, FrozenBuffer.check);
    }

    return result;
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
    this._mustOverride(spec);
  }

  /**
   * Waits for a change to be made to a file at a specific path, including both
   * updating and deleting a value at the path. The return value becomes
   * resolved soon after a change is made or the specified timeout elapses.
   *
   * It is an error to call this method on a file that doesn't exist, in the
   * sense of the `exists()` method. That is, if `exists()` would return
   * `false`, then this method will fail.
   *
   * **Note:** Subclasses are allowed to silently increase the given
   * `timeoutMsec` if they have a _minimum_ timeout. In such cases, it is
   * expected that the minimum is relatively small in terms of human-visible
   * time (e.g. under a second).
   *
   * @param {Int|'never'} timeoutMsec The maximum amount of time (in msec) to
   *   wait for a change. If the requested change does not occur within this
   *   time, then this method returns `false`. This value is clamped as if by
   *   `clampTimeoutMsec()`, see which.
   * @param {string} storagePath The specific path to watch for changes to.
   * @param {FrozenBuffer|string|null} valueOrHash Value which is considered the
   *   "unchanged" value at `storagePath`, or the hash for it. Passing `null`
   *   indicates that the "unchanged" value is that the path is absent from the
   *   file. Passing a buffer for this is just a convenient shorthand for
   *   passing its `.hash`.
   * @returns {boolean} `true` if a change was detected, or `false` if the
   *   call is returning due to timeout.
   */
  async whenChange(timeoutMsec, storagePath, valueOrHash) {
    timeoutMsec = this.clampTimeoutMsec(timeoutMsec);
    StoragePath.check(storagePath);

    if (valueOrHash instanceof FrozenBuffer) {
      valueOrHash = valueOrHash.hash;
    } else if (valueOrHash !== null) {
      // **TODO:** Better hash validity checking.
      TString.nonempty(valueOrHash);
    }

    return this._impl_whenChange(timeoutMsec, storagePath, valueOrHash);
  }

  /**
   * Main implementation of `whenChange()`. It is guaranteed to be called
   * with valid arguments (including having the timeout clamped as specified by
   * the subclass).
   *
   * @abstract
   * @param {Int} timeoutMsec Same as with `whenChange()`.
   * @param {string} storagePath Same as with `whenChange()`.
   * @param {string|null} valueOrHash Same as with `whenChange()`, except that
   *   a buffer argument will have already been converted to a hash.
   * @returns {boolean} Same as with `whenChange()`.
   */
  async _impl_whenChange(timeoutMsec, storagePath, valueOrHash) {
    this._mustOverride(timeoutMsec, storagePath, valueOrHash);
  }
}
