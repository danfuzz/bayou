// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

import BodyOpList from './BodyOpList';

/**
 * {BodyDelta|null} Empty instance. Initialized in the static getter of the
 * same name.
 */
let EMPTY = null;

/**
 * Delta which can be applied to a `BodySnapshot`, along with associated
 * information, to produce an updated snapshot.
 *
 * Instances of this class are immutable.
 */
export default class BodyDelta extends CommonBase {
  /** {BodyDelta} Empty instance. */
  static get EMPTY() {
    if (EMPTY === null) {
      EMPTY = new BodyDelta(BodyOpList.EMPTY);
    }

    return EMPTY;
  }

  /**
   * Constructs an instance.
   *
   * @param {BodyOpList} ops List of operations (raw delta) which can be
   *   applied in context to produce the document with the indicated revision
   *   number.
   */
  constructor(ops) {
    super();

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
    return [this._ops];
  }

  /**
   * {BodyOpList} List of operations (raw delta) used to produce the document
   * with revision number `revNum`.
   */
  get ops() {
    return this._ops;
  }
}
