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
   * @param {Int} revNum The revision number of the document produced by this
   *   instance. If this instance represents the first change to a document,
   *   then this value will be `0`.
   * @param {FrozenDelta} delta Delta which can be applied in context to
   *   produce the document with the indicated revision number.
   * @param {function} [subclassInit = null] Optional function to call (bound as
   *   method) in order to complete instance initialization. (This arrangement
   *   is a hack which compensates for JavaScript's lack of expressiveness
   *   around construction within a class hierarchy where every level aims to
   *   create frozen instances.)
   */
  constructor(revNum, delta, subclassInit = null) {
    super();

    /** {Int} The produced revision number. */
    this._revNum = RevisionNumber.check(revNum);

    /** {FrozenDelta} The actual change, as a delta. */
    this._delta = FrozenDelta.check(delta);

    if (subclassInit !== null) {
      subclassInit.call(this);
    }

    Object.freeze(this);
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._revNum, this._delta];
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
