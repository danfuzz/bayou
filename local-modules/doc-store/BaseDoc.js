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
   * **Note:** This method must be overridden by subclasses.
   *
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
   * **Note:** This method must be overridden by subclasses.
   */
  async _impl_create() {
    this._mustOverride();
  }

  /**
   * The version number of this document. This is the largest value `n` for
   * which `this.changeRead(n)` is valid. If the document has no changes at all,
   * this method returns `null`.
   *
   * @returns {int|null} The version number of this document or `null` if the
   *   document is empty.
   */
  currentVerNum() {
    return VersionNumber.orNull(this._impl_currentVerNum());
  }

  /**
   * Main implementation of `currentVerNum()`.
   *
   * **Note:** This accessor must be overridden by subclasses.
   *
   * @returns {int} The version number of this document.
   */
  _impl_currentVerNum() {
    return this._mustOverride();
  }

  /**
   * The version number of the next change to be appended to this document.
   *
   * **Note:** This is different than just `currentVerNum() + 1` in that
   * `currentVerNum()` is `null` (not `-1`) on an empty document.
   *
   * @returns {int} The version number of the next change.
   */
  nextVerNum() {
    const current = this.currentVerNum();
    return (current === null) ? 0 : (current + 1);
  }

  /**
   * Reads a change, by version number. It is an error to request a change that
   * does not exist on the document.
   *
   * @param {int} verNum The version number for the desired change.
   * @returns {DocumentChange} The change with `verNum` as indicated.
   */
  changeRead(verNum) {
    VersionNumber.check(verNum);
    const result = this._impl_changeRead(verNum);

    if (!result) {
      throw new Error(`No change ${verNum} on document \`${this.id}\``);
    }

    return DocumentChange.check(result);
  }

  /**
   * Main implementation of `changeRead()`. Guaranteed to be called with a
   * valid version number (in that it is a non-negative integer), but which
   * might be out of range or represent a "hole" in the set of changes.
   *
   * **Note:** This method must be overridden by subclasses.
   *
   * @param {int} verNum The version number for the desired change.
   * @returns {DocumentChange|null|undefined} The change with `verNum` as
   *   indicated or a nullish value if there is no such change.
   */
  _impl_changeRead(verNum) {
    return this._mustOverride(verNum);
  }

  /**
   * Appends a change. The arguments to this method are ultimately passed in
   * order to the constructor for `DocumentChange`, with an appropriate version
   * number prepended as the first argument.
   *
   * @param {...*} changeArgs Constructor arguments to `DocumentChange`, except
   *   without the version number.
   */
  changeAppend(...changeArgs) {
    const change = new DocumentChange(this.nextVerNum(), ...changeArgs);
    this._impl_changeAppend(change);
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
   * **Note:** This method must be overridden by subclasses.
   *
   * @param {DocumentChange} change The change to write.
   */
  _impl_changeAppend(change) {
    this._mustOverride(change);
  }
}
