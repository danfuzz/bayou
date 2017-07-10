// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { FrozenDelta } from 'doc-common';
import { CommonBase } from 'util-common';

import RevisionNumber from './RevisionNumber';

/**
 * Delta which can be applied to a `DocumentSnapshot`, along with associated
 * information, to produce an updated snapshot.
 *
 * Instances of this class are returned from calls to `applyDelta()` and
 * `deltaAfter()` as defined by the various `doc-server` classes. See those for
 * more details. Note that the meaning of the `delta` value is different
 * depending on which method the result came from. In particular, there is an
 * implied "expected" result from `applyDelta()` which this instance's `delta`
 * is with respect to.
 *
 * Instances of this class are immutable.
 */
export default class DocumentDelta extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Int} revNum Revision number of the document which is produced by
   *   this instance.
   * @param {FrozenDelta} delta Delta which can be applied in context to
   *   produce the document with the indicated revision number.
   */
  constructor(revNum, delta) {
    super();

    /** {Int} The produced revision number. */
    this._revNum = RevisionNumber.check(revNum);

    /** {FrozenDelta} The actual change, as a delta. */
    this._delta = FrozenDelta.check(delta);

    Object.freeze(this);
  }

  /** {string} Name of this class in the API. */
  static get API_NAME() {
    return 'DocumentDelta';
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._revNum, this._delta];
  }

  /**
   * Constructs an instance from API arguments.
   *
   * @param {Int} revNum Same as with the regular constructor.
   * @param {FrozenDelta} delta Same as with the regular constructor.
   * @returns {DocumentDelta} The constructed instance.
   */
  static fromApi(revNum, delta) {
    return new DocumentDelta(revNum, delta);
  }

  /** {Int} The produced revision number. */
  get revNum() {
    return this._revNum;
  }

  /**
   * {FrozenDelta} Delta used to produce the document with revision number
   * `revNum`.
   */
  get delta() {
    return this._delta;
  }
}
