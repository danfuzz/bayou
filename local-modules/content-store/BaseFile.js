// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TBoolean, TInt, TString } from 'typecheck';
import { CommonBase } from 'util-common';
import { FrozenBuffer } from 'util-server';

import StoragePath from './StoragePath';

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

    /**
     * {Int} Last instantaneous revision number reported by the subclass, or
     * `0` if none ever reported. Reset to `0` in `create()`. This is used to
     * validate the behavior of the subclass.
     */
    this._lastRevNum = -1;
  }

  /** {string} The ID of the file that this instance represents. */
  get id() {
    return this._id;
  }

  /**
   * {Int} The maximum value allowed (inclusive) as the `timeoutMsec` argument
   * to calls to `whenChange()` on this instance. Out-of-range values are
   * clamped to this limit.
   *
   * @abstract
   */
  get maxTimeoutMsec() {
    this._mustOverride();
  }

  /**
   * {Int} The minimum value allowed (inclusive) as the `timeoutMsec` argument
   * to calls to `whenChange()` on this instance. Out-of-range values are
   * clamped to this limit.
   *
   * @abstract
   */
  get minTimeoutMsec() {
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
   * Creates this file if it does not already exist, or re-creates it if it does
   * already exist. After this call, the file both exists and is empty (that is,
   * has no stored values). In addition, the revision number of the file is `0`.
   */
  async create() {
    await this._impl_create();
    this._lastRevNum = 0;
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
   * Deletes the value at the indicated path, if any, and without regard to
   * what value it might have stored.
   *
   * @param {string} storagePath Path to write to.
   * @returns {boolean} `true` once the operation is complete.
   */
  async opForceDelete(storagePath) {
    StoragePath.check(storagePath);

    return this._impl_forceOp(storagePath, null);
  }

  /**
   * Writes a value at the indicated path, without regard to whether there was
   * a value already at the path, nor what value was already stored if any.
   *
   * @param {string} storagePath Path to write to.
   * @param {FrozenBuffer} newValue Value to write.
   * @returns {boolean} `true` once the operation is complete.
   */
  async opForceWrite(storagePath, newValue) {
    StoragePath.check(storagePath);

    return this._impl_forceOp(storagePath, newValue);
  }

  /**
   * Performs a forced-modification operation on the file. This is the main
   * implementation of `opForceDelete()` and `opForceWrite()`. Arguments are
   * guaranteed by the superclass to be valid. Passing `null` for `newValue`
   * corresponds to the `opForceDelete()` operation.
   *
   * @abstract
   * @param {string} storagePath Path to write to.
   * @param {FrozenBuffer|null} newValue Value to write, or `null` if the value
   *   at `path` is to be deleted.
   * @returns {boolean} `true` once the write operation is complete.
   */
  async _impl_forceOp(storagePath, newValue) {
    this._mustOverride(storagePath, newValue);
  }

  /**
   * Deletes the value at the indicated path, failing if it is not the indicated
   * value at the time of deletion. If the expected value doesn't match, this
   * method returns `false`. All other problems are indicated by throwing
   * errors.
   *
   * @param {string} storagePath Path to write to.
   * @param {FrozenBuffer} oldValue Value expected to be stored at `path` at the
   *   moment of deletion.
   * @returns {boolean} `true` if the delete is successful, or `false` if it
   *   failed due to `path` having an unexpected value.
   */
  async opDelete(storagePath, oldValue) {
    StoragePath.check(storagePath);
    FrozenBuffer.check(oldValue);

    return this._impl_op(storagePath, oldValue, null);
  }

  /**
   * Writes a value at the indicated path, failing if there is already any
   * value stored at the path. If there is already a value, this method returns
   * `false`. All other problems are indicated by throwing errors.
   *
   * @param {string} storagePath Path to write to.
   * @param {FrozenBuffer} newValue Value to write.
   * @returns {boolean} `true` if the write is successful, or `false` if it
   *   failed due to `path` already having a value.
   */
  async opNew(storagePath, newValue) {
    StoragePath.check(storagePath);
    FrozenBuffer.check(newValue);

    return this._impl_op(storagePath, null, newValue);
  }

  /**
   * Writes a value at the indicated path, failing if there is already any
   * value at the path other than the given one. In case of value-mismatch
   * failure, this method returns `false`. All other problems are indicated by
   * throwing errors.
   *
   * @param {string} storagePath Path to write to.
   * @param {FrozenBuffer} oldValue Value expected to be stored at `path` at the
   *   moment of writing.
   * @param {FrozenBuffer} newValue Value to write.
   * @returns {boolean} `true` if the write is successful, or `false` if it
   *   failed due to value mismatch.
   */
  async opReplace(storagePath, oldValue, newValue) {
    StoragePath.check(storagePath);
    FrozenBuffer.check(oldValue);
    FrozenBuffer.check(newValue);

    return this._impl_op(storagePath, oldValue, newValue);
  }

  /**
   * Performs a modification operation on the file. This is the main
   * implementation of `opDelete()`, `opNew()`, and `opReplace()`. Arguments are
   * guaranteed by the superclass to be valid. Passing `null` for `oldValue`
   * corresponds to the `opNew()` operation. Passing `null` for `newValue`
   * corresponds to the `opDelete()` operation.
   *
   * @abstract
   * @param {string} storagePath Path to write to.
   * @param {FrozenBuffer|null} oldValue Value expected to be stored at `path`
   *   at the moment of writing, or `null` if `path` is expected to have nothing
   *   stored at it.
   * @param {FrozenBuffer|null} newValue Value to write, or `null` if the value
   *   at `path` is to be deleted.
   * @returns {boolean} `true` if the write is successful, or `false` if it
   *   failed due to value mismatch.
   */
  async _impl_op(storagePath, oldValue, newValue) {
    this._mustOverride(storagePath, oldValue, newValue);
  }

  /**
   * Reads the value stored at the given path. This throws an error if there is
   * no value stored at the given path.
   *
   * @param {string} storagePath Path to read from.
   * @returns {FrozenBuffer} Value stored at the indicated path.
   */
  async pathRead(storagePath) {
    const result =
      await this._impl_pathReadOrNull(StoragePath.check(storagePath));

    if (result === null) {
      throw new Error(`No value at path: ${storagePath}`);
    }

    return FrozenBuffer.check(result);
  }

  /**
   * Reads the value stored at the given path. This returns `null` if there is
   * no value stored at the given path.
   *
   * @param {string} storagePath Path to read from.
   * @returns {FrozenBuffer|null} Value stored at the indicated path, or `null`
   *   if there is none.
   */
  async pathReadOrNull(storagePath) {
    const result =
      await this._impl_pathReadOrNull(StoragePath.check(storagePath));

    return (result === null) ? result : FrozenBuffer.check(result);
  }

  /**
   * Reads the value stored at the given path. This method is guaranteed to be
   * called with a valid value for `storagePath`. This is the main
   * implementation for the methods `pathRead()` and `pathReadOrNull()`.
   *
   * @abstract
   * @param {string} storagePath Path to read from.
   * @returns {FrozenBuffer|null} Value stored at the indicated path, or `null`
   *   if there is none.
   */
  async _impl_pathReadOrNull(storagePath) {
    this._mustOverride(storagePath);
  }

  /**
   * Gets the instantaneously current revision number of the file. The revision
   * number starts at `0` for a newly-created file and increases monotonically
   * as changes are made to it.
   *
   * **Note:** Due to the asynchronous nature of the system, it is possible
   * (common even) for the revision number to have increased by the time this
   * method returns to a caller.
   *
   * @returns {Int} The instantaneously current revision number of the file.
   */
  async revNum() {
    const result = TInt.min(await this._impl_revNum(), this._lastRevNum);

    this._lastRevNum = result;
    return result;
  }

  /**
   * Main implementation of `revNum()`.
   *
   * @abstract
   * @returns {Int} The instantaneously current revision number of the file.
   */
  async _impl_revNum() {
    this._mustOverride();
  }

  /**
   * Waits for a change to be made to a file, either in general or on a specific
   * path. The return value becomes resolved soon after a change is made or the
   * specified timeout elapses.
   *
   * When watching a path, any change to that path counts, including all of:
   * storing a value at a path not previously stored at; deleting the value at
   * a path; or storing a new value at an already-used path.
   *
   * **Note:** Subclasses are allowed to silently increase the given
   * `timeoutMsec` if they have a _minimum_ timeout. In such cases, it is
   * expected that the minimum is relatively small in terms of human-visible
   * time (e.g. under a second).
   *
   * @param {Int} timeoutMsec The maximum amount of time (in msec) to wait for
   *   a change. If the requested change does not occur within this time, then
   *   this method returns `null` instead of a revision number. This value is
   *   silently clamped to the range `minTimeoutMsec..maxTimeoutMsec`
   *   (inclusive) where those values are defined on the instance being called.
   *   As a convenience, passing this value as `-1` is equivalent to passing
   *   `maxTimeoutMsec`. Other than `-1` specifically, it is an error to pass a
   *   negative number for this argument.
   * @param {Int} baseRevNum The revision number which is the base for the
   *   request. The request is to detect a change with respect to this revision.
   * @param {string|null} [storagePath = null] The specific path to watch for
   *   changes to, or `null` if any file change will suffice.
   * @returns {Int|null} If a change was detected, the revision number at which
   *   it was detected (which might be larger than the actual revision number at
   *   which the change was made); or `null` if the call is returning due to
   *   timeout.
   */
  async whenChange(timeoutMsec, baseRevNum, storagePath = null) {
    if (timeoutMsec === -1) {
      timeoutMsec = this.maxTimeoutMsec;
    } else {
      TInt.min(timeoutMsec, 0);
      timeoutMsec = Math.max(timeoutMsec, this.minTimeoutMsec);
      timeoutMsec = Math.min(timeoutMsec, this.maxTimeoutMsec);
    }

    TInt.min(baseRevNum, 0);
    StoragePath.orNull(storagePath);

    const result =
      await this._impl_whenChange(timeoutMsec, baseRevNum, storagePath);

    if (result === null) {
      return null;
    }

    // For a non-`null` result, validate it and update `_lastRevNum`.
    TInt.min(result, baseRevNum + 1);
    if (result > this._lastRevNum) {
      this._lastRevNum = result;
    }

    return result;
  }

  /**
   * Main implementation of `whenChange()`. It is guaranteed to be called
   * with valid arguments (including having the timeout clamped as specified by
   * the subclass), _except_ that `baseRevNum` is not guaranteed to refer to an
   * existing revision. (That guarantee can't actually be made at this layer due
   * to the asynchronous nature of the system.)
   *
   * @abstract
   * @param {Int} timeoutMsec Same as with `whenChange()`.
   * @param {Int} baseRevNum Same as with `whenChange()`.
   * @param {string|null} storagePath Same as with `whenChange()`.
   * @returns {Int|null} Same as with `whenChange()`.
   */
  async _impl_whenChange(timeoutMsec, baseRevNum, storagePath) {
    this._mustOverride(timeoutMsec, baseRevNum, storagePath);
  }
}
