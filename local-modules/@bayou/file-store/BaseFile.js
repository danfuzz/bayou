// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { StorageId, StoragePath, FileChange } from '@bayou/file-store-ot';
import { FileSnapshot, RevisionNumber } from '@bayou/ot-common';
import { TBoolean, TInt, TString } from '@bayou/typecheck';
import { CommonBase, Errors } from '@bayou/util-common';

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
    this._id = TString.check(fileId);
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
   * case, `null` is interpreted the same as `maxTimeoutMsec`. As a
   * double-special case, `null` is treated as a period of one day if
   * `maxTimeoutMsec` is `null`. It is an error to pass a value less than `0`.
   *
   * @param {Int|null} value The millisecond timeout value to clamp, or `null`
   *   to indicate the maximum possible value.
   * @returns {Int} The clamped value.
   */
  clampTimeoutMsec(value) {
    if (value === null) {
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
   * Gets the instantaneously-current revision number of the file controlled by
   * this instance. It is an error to call this on a file that does not exist
   * (in the sense of {@link #exists}).
   *
   * **Note:** Due to the asynchronous nature of the system, the value returned
   * here could be out-of-date by the time it is received by the caller. As
   * such, even when used promptly, it should not be treated as "definitely
   * current" but more like "probably current but possibly just a lower bound."
   *
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {Int} The instantaneously-current revision number.
   */
  async currentRevNum(timeoutMsec = null) {
    const revNum = await this._impl_currentRevNum(timeoutMsec);
    return RevisionNumber.check(revNum);
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
   * Appends a new change to the document. On success, this returns `true`.
   *
   * It is an error to call this method on a file that doesn't exist, in the
   * sense of {@link #exists}. That is, if {@link #exists} would return
   * `false`, then this method will fail.
   *
   * @param {FileChange} fileChange Change to append.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {boolean} Success flag. `true` indicates that the change was
   *   appended, and `false` indicates that the operation failed due to a lost
   *   append race.
   * @throws {Error} Thrown for failures _other than_ lost append race.
   */
  async appendChange(fileChange, timeoutMsec = null) {
    FileChange.check(fileChange);

    const result = await this._impl_appendChange(fileChange, timeoutMsec);
    TBoolean.check(result);

    return result;
  }

  /**
   * Gets a snapshot of the full file as of the indicated revision. It is an
   * error to request a revision that does not yet exist. For subclasses that
   * don't keep full history, it is also an error to request a revision that is
   * _no longer_ available; in this case, the error name is always
   * `revisionNotAvailable`.
   *
   * @param {Int|null} [revNum = null] Which revision to get. If passed as
   *   `null`, indicates the current (most recent) revision. **Note:** Due to
   *   the asynchronous nature of the system, when passed as `null` the
   *   resulting revision might already have been superseded by the time it is
   *   returned to the caller.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {FileSnapshot} Snapshot of the indicated revision.
   */
  async getSnapshot(revNum = null, timeoutMsec = null) {
    const currentRevNum = await this.currentRevNum();

    revNum = (revNum === null)
      ? currentRevNum
      : RevisionNumber.maxInc(revNum, currentRevNum);

    const result = await this._impl_getSnapshot(revNum, timeoutMsec);

    if (result === null) {
      throw Errors.revisionNotAvailable(revNum);
    }

    return FileSnapshot.check(result);
  }

  /**
   * Waits for a path to change away from given hash. It returns only
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
   * @param {StoragePath} storagePath The storage path to use to get the
   *   data to validate.
   * @param {FrozenBuffer} hash Hash to validate against.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   */
  async whenPathIsNot(storagePath, hash, timeoutMsec) {
    StoragePath.check(storagePath);
    hash = StorageId.checkOrGetHash(hash);

    await this._impl_whenPathIsNot(storagePath, hash, timeoutMsec);

    return;
  }

  /**
   * Subclass-specific implementation of {@link #appendChange}. Appends a new
   * change to the document. On success, this returns `true`.
   *
   * It is an error to call this method on a file that doesn't exist, in the
   * sense of the method {@link #exists} method. That is, if {@link #exists}
   * would return `false`, then this method will fail.
   *
   * Subclasses must override this method.
   *
   * @abstract
   * @param {FileChange} fileChange Change to append. Must be an
   *   instance of FileChange.
   * @param {Int|null} timeoutMsec Maximum amount of time to allow in this call,
   *   in msec. This value will be silently clamped to the allowable range as
   *   defined by {@link Timeouts}. `null` is treated as the maximum allowed
   *   value.
   * @returns {boolean} Success flag. `true` indicates that the change was
   *   appended, and `false` indicates that the operation failed due to a lost
   *   append race.
   * @throws {Error} Thrown for failures _other than_ lost append race.
   */
  async _impl_appendChange(fileChange, timeoutMsec) {
    return this._mustOverride(fileChange, timeoutMsec);
  }

  /**
   * Subclass-specific implementation of {@link #create}. Subclasses must
   * override this method.
   *
   * @abstract
   */
  async _impl_create() {
    this._mustOverride();
  }

  /**
   * Subclass-specific implementation of {@link #currentRevNum}. Subclasses must
   * override this method.
   *
   * @abstract
   * @returns {Int} The instantaneously current revision number of the file.
   */
  async _impl_currentRevNum() {
    return this._mustOverride();
  }

  /**
   * Subclass-specific implementation of {@link #delete}. Subclasses must
   * override this method.
   *
   * @abstract
   */
  async _impl_delete() {
    this._mustOverride();
  }

  /**
   * Subclass-specific implementation of {@link #exists}. Subclasses must
   * override this method.
   *
   * @abstract
   * @returns {boolean} `true` iff this file exists.
   */
  async _impl_exists() {
    return this._mustOverride();
  }

  /**
   * Subclass-specific implementation of {@link #getSnapshot}. Subclasses must
   * override this method.
   *
   * @abstract
   * @param {Int} revNum Which revision to get. Guaranteed to be a revision
   *   number for the instantaneously-current revision or earlier.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {FileSnapshot|null} Snapshot of the indicated revision. A return
   *   value of `null` specifically indicates that `revNum` is a revision older
   *   than what this instance can provide (and will cause this class to report
   *   a `revisionNotAvailable` error).
   * @throws {Error} Thrown for any problem other than the revision not being
   *   available due to it being aged out.
   */
  async _impl_getSnapshot(revNum, timeoutMsec) {
    return this._mustOverride(revNum, timeoutMsec);
  }

  /**
   * Subclass-specific implementation of {@link #whenPathIsNot}. Subclasses must
   * override this method.
   *
   * @abstract
   * @param {StoragePath} storagePath The storage path to use to get the
   *   data to validate.
   * @param {FrozenBuffer} hash Hash to validate against.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   */
  async _impl_whenPathIsNot(storagePath, hash, timeoutMsec) {
    this._mustOverride(storagePath, hash, timeoutMsec);
  }
}
