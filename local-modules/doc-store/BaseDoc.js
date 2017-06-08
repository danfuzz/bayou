// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { DocumentChange, VersionNumber } from 'doc-common';
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
    this._impl_create(DocumentChange.firstChange());
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
   * Performs a forced-modification operation on the document. This is the main
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
    return this._mustOverride(storagePath, newValue);
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
    return this._mustOverride(storagePath);
  }
}
