// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

import BodyOpList from './BodyOpList';
import RevisionNumber from './RevisionNumber';

/**
 * {BodyDelta|null} Empty instance. Initialized in the static getter of the
 * same name.
 */
let EMPTY = null;

/**
 * Delta which can be applied to a `BodySnapshot`, along with associated
 * information, to produce an updated snapshot.
 *
 * Instances of this class are returned from calls to `body_update()` and
 * `body_deltaAfter()` as defined by the various `doc-server` classes. See those
 * for more details. Note that the meaning of the `delta` value is different
 * depending on which method the result came from. In particular, there is an
 * implied "expected" result from `body_update()` which this instance's
 * `ops` list is with respect to.
 *
 * Instances of this class are immutable.
 */
export default class BodyDelta extends CommonBase {
  /** {BodyDelta} Empty instance. */
  static get EMPTY() {
    if (EMPTY === null) {
      EMPTY = new BodyDelta(0, BodyOpList.EMPTY);
    }

    return EMPTY;
  }

  /**
   * Constructs an instance.
   *
   * @param {Int} revNum The revision number of the document produced by this
   *   instance. If this instance represents the first change to a document,
   *   then this value will be `0`.
   * @param {BodyOpList} ops List of operations (raw delta) which can be
   *   applied in context to produce the document with the indicated revision
   *   number.
   */
  constructor(revNum, ops) {
    super();

    /** {Int} The produced revision number. */
    this._revNum = RevisionNumber.check(revNum);

    /**
     * {BodyOpList} The actual change, as a list of operations (a raw delta).
     */
    this._ops = BodyOpList.check(ops);

    Object.freeze(this);
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._revNum, this._ops];
  }

  /** {Int} The produced revision number. */
  get revNum() {
    return this._revNum;
  }

  /**
   * {BodyOpList} List of operations (raw delta) used to produce the document
   * with revision number `revNum`.
   */
  get ops() {
    return this._ops;
  }
}
