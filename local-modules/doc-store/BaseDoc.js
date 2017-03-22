// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { DocumentChange, VersionNumber } from 'doc-common';
import { TBoolean, TObject, TString } from 'typecheck';
import { BaseClass } from 'util-common';

/**
 * Base class representing access to a particular document. Subclasses must
 * override several methods defined by this class, as indicated in the
 * documentation. Methods to override are all named with the prefix `_impl_`.
 *
 * The model that this class embodies is that a document is an append-only log
 * of changes, with each change having a version number that _must_ form a
 * zero-based integer sequence. Changes are random-access.
 */
export default class BaseDoc extends BaseClass {
  /**
   * Checks that a value is an instance of this class. Throws an error if not.
   *
   * @param {*} value Value to check.
   * @returns {BaseDoc} `value`.
   */
  static check(value) {
    return TObject.check(value, BaseDoc);
  }

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

  /** The ID of the document that this instance represents. */
  get id() {
    return this._id;
  }

  /**
   * Indicates whether or not this document exists in the store.
   *
   * @returns {boolean} `true` iff this document exists.
   */
  exists() {
    const result = this._impl_exists();
    return TBoolean.check(result);
  }

  /**
   * Main implementation of `exists()`.
   *
   * **Note:** This method must be overridden by subclasses.
   *
   * @returns {boolean} `true` iff this document exists.
   */
  _impl_exists() {
    return this._mustOverride();
  }

  /**
   * Creates this document if it does not already exist, or re-creates it if it
   * does already exist. After this call, the document both exists and is
   * empty.
   */
  create() {
    // This is just a pass-through. The point is to maintain the pattern of
    // `_impl_` as the things that subclasses override.
    this._impl_create();
  }

  /**
   * Main implementation of `create()`.
   *
   * **Note:** This method must be overridden by subclasses.
   */
  _impl_create() {
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
   * Appends a change. This uses the change's `verNum` to determine the change
   * number. This _must_ be the `nextVerNum()`, otherwise this method will throw
   * an error.
   *
   * @param {DocumentChange} change The change to append.
   */
  changeAppend(change) {
    DocumentChange.check(change);
    const verGot = change.verNum;
    const verExpect = this.nextVerNum();
    if (verGot !== verExpect) {
      throw new Error(
        `Incorrect \`verNum\` for change. Got ${verGot}, expected ${verExpect}`);
    }
    this._impl_changeAppend(change);
  }

  /**
   * Main implementation of `changeAppend()`. Guaranteed to be called with a
   * valid change instance, including that it has the correct `verNum`.
   *
   * **Note:** This method must be overridden by subclasses.
   *
   * @param {DocumentChange} change The change to write.
   */
  _impl_changeAppend(change) {
    this._mustOverride(change);
  }
}
