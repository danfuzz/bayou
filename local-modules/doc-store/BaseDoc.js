// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { DocumentChange, VersionNumber } from 'doc-common';
import { Typecheck } from 'typecheck';

/**
 * Base class representing access to a particular document. Subclasses must
 * override several methods defined by this class, as indicated in the
 * documentation. Methods to override are all named with the prefix `_impl_`.
 */
export default class BaseDoc {
  /**
   * Constructs an instance.
   *
   * @param {string} docId The ID of the document this instance represents.
   */
  constructor(docId) {
    /** The ID of the document that this instance represents. */
    this._id = Typecheck.stringNonempty(docId);
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
    return Typecheck.boolean(result);
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
   * which `this.changeRead(n)` is valid.
   *
   * @returns {int} The version number of this document.
   */
  currentVerNum() {
    return VersionNumber.check(this._impl_currentVerNum());
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

    return Typecheck.instance(result, DocumentChange);
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
   * Writes a change. This uses the change's `verNum` to determine the change
   * number. If the indicated change already exists, this method overwrites it.
   *
   * @param {DocumentChange} change The change to write.
   */
  changeWrite(change) {
    this._impl_changeWrite(Typecheck.instance(change, DocumentChange));
  }

  /**
   * Main implementation of `changeRead()`. Guaranteed to be called with a
   * valid change instance.
   *
   * **Note:** This method must be overridden by subclasses.
   *
   * @param {DocumentChange} change The change to write.
   */
  _impl_changeWrite(change) {
    this._mustOverride(change);
  }

  /**
   * Helper function which always throws. Using this both documents the intent
   * in code and keeps the linter from complaining about the documentation
   * (`@param`, `@returns`, etc.).
   *
   * @param {...*} args_unused Anything you want, to keep the linter happy.
   */
  _mustOverride(...args_unused) {
    throw new Error('Must override.');
  }
}
