// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { DocumentChange, FrozenDelta, Timestamp, VersionNumber }
  from 'doc-common';
import { TBoolean, TString } from 'typecheck';
import { CommonBase } from 'util-common';
import { FrozenBuffer } from 'util-server';

import StoragePath from './StoragePath';

/**
 * Base class representing access to a particular document. Subclasses must
 * override several methods defined by this class, as indicated in the
 * documentation. Methods to override are all named with the prefix `_impl_`.
 *
 * The model that this class embodies is that a document is an append-only log
 * of changes, with each change having a version number that _must_ form a
 * zero-based integer sequence. Changes are random-access.
 */
export default class BaseDoc extends CommonBase {
  /**
   * Gets the appropriate first change to a document (empty delta) for the
   * current moment in time.
   *
   * @returns {FrozenDelta} An appropriate initial change.
   */
  static _firstChange() {
    return new DocumentChange(0, Timestamp.now(), FrozenDelta.EMPTY, null);
  }

  /**
   * Constructs an instance.
   *
   * @param {string} docId The ID of the document this instance represents.
   */
  constructor(docId) {
    super();

    /** {string} The ID of the document that this instance represents. */
    this._id = TString.nonempty(docId);
  }

  /** {string} The ID of the document that this instance represents. */
  get id() {
    return this._id;
  }

  /**
   * Indicates whether or not this document exists in the store. Calling this
   * method will _not_ cause a non-existent document to come into existence.
   *
   * **Note:** Documents that exist always contain at least one change.
   *
   * @returns {boolean} `true` iff this document exists.
   */
  async exists() {
    const result = this._impl_exists();
    return TBoolean.check(await result);
  }

  /**
   * Main implementation of `exists()`.
   *
   * @abstract
   * @returns {boolean} `true` iff this document exists.
   */
  async _impl_exists() {
    return this._mustOverride();
  }

  /**
   * Creates this document if it does not already exist, or re-creates it if it
   * does already exist. After this call, the document both exists and is
   * empty. "Empty" in this case means that it contains exactly one change,
   * which represents the null operation on the document. (That is, its delta
   * is empty.)
   */
  async create() {
    this._impl_create(BaseDoc._firstChange());
  }

  /**
   * Main implementation of `create()`, which takes an additional argument
   * of the first change to include in the document.
   *
   * @abstract
   * @param {DocumentChange} firstChange The first change to include in the
   *   document.
   */
  async _impl_create(firstChange) {
    this._mustOverride(firstChange);
  }

  /**
   * Gets the current version number of this document. This is the largest value
   * `n` for which `this.changeRead(n)` is definitely valid. It is only valid
   * to call this method on a document that exists and has valid data.
   *
   * With regard to "definitely" above, at the moment a call to this method is
   * complete, it is possible for there to _already_ be document changes in
   * flight, which will be serviced asynchronously. This notably means that,
   * should the result of a call to this method be subsequently used as part of
   * an _asynchronous_ call, by the time that _that_ call is executed, the
   * current version number may no longer be the same. Hence, it is imperative
   * for code to _not_ assume a stable version number when any asynchrony is
   * possible.
   *
   * @returns {Int} The current version number of this document.
   */
  async currentVerNum() {
    const result = VersionNumber.orNull(await this._impl_currentVerNum());

    if (result === null) {
      throw new Error('Document is empty, invalid, or in need of migration.');
    }

    return result;
  }

  /**
   * Main implementation of `currentVerNum()`. This method can be called without
   * error whether or not the document exists (as opposed to `currentVerNum()`);
   * for a non-existent document, this method returns `null`. In addition, this
   * method returns `null` if the document exists but is not in a recognized
   * format (e.g. if `needsMigration()` would return `true`).
   *
   * @abstract
   * @returns {Int|null} The version number of this document or `null` if the
   *   document is empty, invalid, or in need of migration.
   */
  async _impl_currentVerNum() {
    return this._mustOverride();
  }

  /**
   * Reads a change, by version number. It is an error to request a change that
   * does not exist on the document. If called on a non-existent document, this
   * method does _not_ cause that document to be created.
   *
   * @param {Int} verNum The version number for the desired change.
   * @returns {DocumentChange} The change with `verNum` as indicated.
   */
  async changeRead(verNum) {
    VersionNumber.check(verNum);

    const result = await this._impl_changeRead(verNum);
    return DocumentChange.check(result);
  }

  /**
   * Main implementation of `changeRead()`. Guaranteed to be called with a
   * valid version number (in that it is a non-negative integer), but which
   * might be out of range. This method should throw an exception if `verNum`
   * turns out not to refer to an existing change.
   *
   * @abstract
   * @param {Int} verNum The version number for the desired change.
   * @returns {DocumentChange} The change with `verNum` as indicated.
   */
  async _impl_changeRead(verNum) {
    return this._mustOverride(verNum);
  }

  /**
   * Appends a change, if it is valid. On success, this returns `true`. On
   * failure because the version number of the change is incorrect (presumably
   * because this attempt represents the losing side of an append race), this
   * returns `false`. All other problems are reported as thrown errors.
   *
   * **Note:** The reason `verNum` is passed explicitly instead of just
   * assumed to be correct is that, due to the asynchronous nature of the
   * execution of this method, the calling code cannot know for sure whether or
   * not _its_ concept of the appropriate `verNum` is actually the right value
   * by the time the change is being appended. If `verNum` were simply assumed,
   * what you might see is a `delta` that was intended to apply to (say)
   * `verNum - 1` but which got recorded as being applied to `verNum` and would
   * hence be incorrect.
   *
   * @param {DocumentChange} change The change to append.
   * @returns {boolean} `true` if the append was successful, or `false` if it
   *   was not due to `change` having an incorrect `verNum`.
   */
  async changeAppend(change) {
    // It is invalid to ever use this method to append a change with
    // `verNum === 0`, because that would be the first change to the document,
    // and the _only_ way to get a first change into a document is via a call to
    // `create()` (which passes the change through to the subclass via
    // `_impl_create()`). We check this up-front here instead of blithely
    // passing it down to the subclass, because doing the latter would force the
    // subclass to need trickier code to avoid inadvertently creating the
    // document in cases where it didn't already exist.
    if (change.verNum === 0) {
      throw new Error('Cannot ever append the very first version.');
    }

    return this._impl_changeAppend(change);
  }

  /**
   * Main implementation of `changeAppend()`. Guaranteed to be called with a
   * structurally valid change instance with a `verNum` of at least `1`. Beyond
   * the minimum limit, `verNum` still has to be validated.
   *
   * On that last point, `change` will typically have been constructed with a
   * valid `verNum` at the time of construction, but due to the asynchronous
   * nature of the system, it is possible for other changes to have been
   * appended between change construction and the synchronous call to this
   * method. Therefore, it is imperative to synchronously validate the version
   * number just before accepting the change.
   *
   * @abstract
   * @param {DocumentChange} change The change to append.
   * @returns {boolean} `true` if the append was successful, or `false` if it
   *   was not due to `change` having an incorrect `verNum`.
   */
  async _impl_changeAppend(change) {
    return this._mustOverride(change);
  }

  /**
   * Indicates whether this document needs migration. That is, this returns
   * `true` if the document is in a format that is not directly recognized by
   * this class.
   *
   * @returns {boolean} `true` iff the document needs migration.
   */
  async needsMigration() {
    // This is just a pass-through. The point is to maintain the pattern of
    // `_impl_` as the things that subclasses override.
    return this._impl_needsMigration();
  }

  /**
   * Main implementation of `needsMigration()`.
   *
   * @abstract
   * @returns {boolean} `true` iff the document needs migration.
   */
  async _impl_needsMigration() {
    return this._mustOverride();
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
   * Performs a modification operation on the document. This is the main
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
    return this._mustOverride(storagePath, oldValue, newValue);
  }

  /**
   * Reads the value stored at the given path. This throws an error if there is
   * no value stored at the given path.
   *
   * @param {string} storagePath Path to read from.
   * @returns {FrozenBuffer} Value stored at the indicated path.
   */
  async pathRead(storagePath) {
    const result = this.pathReadOrNull(storagePath);
    if (result === null) {
      throw new Error(`No value at path: ${storagePath}`);
    }

    return result;
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
    StoragePath.check(storagePath);

    const result = this._impl_pathReadOrNull(storagePath);

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
    return this._mustOverride(storagePath);
  }
}
