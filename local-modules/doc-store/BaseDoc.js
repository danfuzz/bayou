// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { DocumentChange, VersionNumber } from 'doc-common';
import { TBoolean, TString } from 'typecheck';
import { CommonBase } from 'util-common';

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

    /** The ID of the document that this instance represents. */
    this._id = TString.nonempty(docId);
  }

  /** {string} The ID of the document that this instance represents. */
  get id() {
    return this._id;
  }

  /**
   * Indicates whether or not this document exists in the store.
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
   * empty.
   */
  async create() {
    // This is just a pass-through. The point is to maintain the pattern of
    // `_impl_` as the things that subclasses override.
    this._impl_create();
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
   * Gets the current version number of this document. This is the largest value
   * `n` for which `this.changeRead(n)` is definitely valid. If the document has
   * no changes at all, this method returns `null`.
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
   * @returns {Int|null} The version number of this document or `null` if the
   *   document is empty.
   */
  currentVerNum() {
    return VersionNumber.orNull(this._impl_currentVerNum());
  }

  /**
   * Main implementation of `currentVerNum()`.
   *
   * @abstract
   * @returns {Int|null} The version number of this document or `null` if the
   *   document is empty.
   */
  _impl_currentVerNum() {
    return this._mustOverride();
  }

  /**
   * Reads a change, by version number. It is an error to request a change that
   * does not exist on the document.
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
   * Appends a change. The arguments to this method are ultimately passed in
   * order to the constructor for `DocumentChange`. This will throw an exception
   * if the given `verNum` (first argument) turns out not to be the actual
   * appropriate next version.
   *
   * **Note:** The (implicit) return value from this method is a promise that
   * resolves once the append operation is complete, or becomes rejected with
   * a reason describing the problem such as, notably, the `verNum` being
   * invalid.
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
   * @param {...*} changeArgs Constructor arguments to `DocumentChange`.
   */
  async changeAppend(...changeArgs) {
    const change = new DocumentChange(...changeArgs);
    await this._impl_changeAppend(change);
  }

  /**
   * Main implementation of `changeAppend()`. Guaranteed to be called with a
   * structurally valid change instance, except that the `verNum` does have to
   * be validated.
   *
   * On that last point, `change` will have been constructed with a valid
   * `verNum` at the time of construction, but due to the asynchronous nature of
   * the system, it is possible for other changes to have been appended between
   * change construction and the synchronous call to this method. Therefore, it
   * is imperative to synchronously validate the version number just before
   * accepting the change.
   *
   * @abstract
   * @param {DocumentChange} change The change to write.
   */
  async _impl_changeAppend(change) {
    this._mustOverride(change);
  }
}
