// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Typecheck from 'typecheck';

/**
 * Base class representing access to a particular document. Subclasses must
 * override several methods defined by this class, as indicated in the
 * documentation.
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
   * **Note:** This method must be overridden by subclasses.
   *
   * @returns {boolean} `true` iff this document exists.
   */
  exists() {
    return this._mustOverride();
  }

  /**
   * Creates this document if it does not already exist, or re-creates it if it
   * does already exist. After this call, the document both exists and is
   * empty.
   *
   * **Note:** This method must be overridden by subclasses.
   */
  create() {
    this._mustOverride();
  }

  /**
   * The version number of this document. This is the largest value `n` for
   * which `this.changeRead(n)` is valid.
   *
   * **Note:** This accessor must be overridden by subclasses.
   *
   * @returns {int} The version number of this document.
   */
  get currentVerNum() {
    return this._mustOverride();
  }

  /**
   * Reads a change, by version number. It is an error to request a change that
   * does not exist on the document.
   *
   * **Note:** This method must be overridden by subclasses.
   *
   * @param {int} verNum The version number for the desired change.
   * @returns {DocumentChange} The change with `verNum` as indicated.
   */
  changeRead(verNum) {
    return this._mustOverride(verNum);
  }

  /**
   * Writes a change. This uses the change's `verNum` to determine the change
   * number. If the indicated change already exists, this method overwrites it.
   *
   * **Note:** This method must be overridden by subclasses.
   *
   * @param {DocumentChange} change The change to write.
   */
  changeWrite(change) {
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
