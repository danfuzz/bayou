// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TArray } from 'typecheck';
import { CommonBase } from 'util-common';

import Caret from './Caret';
import RevisionNumber from './RevisionNumber';

/**
 * Snapshot of information about all active sessions on a particular document.
 * Instances of this class are always frozen (immutable).
 */
export default class CaretSnapshot extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Int} revNum Revision number of the document for which this snapshot
   *   is valid.
   * @param {array<Caret>} carets Array of all the active carets.
   */
  constructor(revNum, carets) {
    super();

    /** {Int} The associated revision number. */
    this._revNum = RevisionNumber.check(revNum);

    /** {array<Caret>} Array of all the active carets. */
    this._carets = Object.freeze(TArray.check(carets, Caret.check));

    Object.freeze(this);
  }

  /** Name of this class in the API. */
  static get API_NAME() {
    return 'CaretSnapshot';
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._revNum, this._carets];
  }

  /**
   * Constructs an instance from API arguments.
   *
   * @param {Int} revNum Same as with the regular constructor.
   * @param {array<Caret>} carets Same as with the regular constructor.
   * @returns {CaretSnapshot} The constructed instance.
   */
  static fromApi(revNum, carets) {
    return new CaretSnapshot(revNum, carets);
  }

  /** {Int} The produced revision number. */
  get revNum() {
    return this._revNum;
  }

  /**
   * {array<Caret>} Array of active carets. It is guaranteed to be a frozen
   * (immutable) value.
   */
  get carets() {
    return this._carets;
  }
}
