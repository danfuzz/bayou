// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Typecheck from 'typecheck';

import BaseDoc from './BaseDoc';

/**
 * Base class representing access to a particular document. Subclasses must
 * override several methods defined by this class, as indicated in the
 * documentation.
 */
export default class LocalDoc extends BaseDoc {
  /**
   * Constructs an instance.
   *
   * @param {string} docId The ID of the document this instance represents.
   */
  constructor(docId) {
    super(docId);

    /** Document exists? */
    this._exists = false;

    /**
     * Array of changes. Index `n` contains the change that produces version
     * number `n`.
     */
    this._changes = [];
  }

  /**
   * Implementation as required by the superclass.
   *
   * @returns {boolean} `true` iff this document exists.
   */
  exists() {
    return this._exists;
  }

  /**
   * Implementation as required by the superclass.
   */
  create() {
    this._exists = true;
    this._changes = [];
  }

  /**
   * Implementation as required by the superclass.
   *
   * @returns {int} The version number of this document.
   */
  get currentVerNum() {
    return this._changes.length - 1;
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {int} verNum The version number for the desired change.
   * @returns {DocumentChange} The change with `verNum` as indicated.
   */
  changeRead(verNum) {
    const result = this._changes[Typecheck.versionNumber(verNum)];

    if (!result) {
      throw new Error(`No such change: ${verNum}`);
    }

    return result;
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {DocumentChange} change The change to write.
   */
  changeWrite(change) {
    this._changes[change.verNum] = change;
  }
}
