// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TArray } from 'typecheck';
import { CommonBase } from 'util-common';

import FileSnapshot from './FileSnapshot';
import PredicateOp from './PredicateOp';

/**
 * File predicate specification. This is a set of operations (each an instance
 * of {@link PredicateOp}) which is to be executed with respect to a {@link
 * FileSnapshot}.
 */
export default class PredicateSpec extends CommonBase {
  /**
   * Constructs an instance consisting of all of the indicated operations.
   *
   * @param {...PredicateOp} ops The operations to perform.
   */
  constructor(...ops) {
    TArray.check(ops, v => PredicateOp.check(v));

    super();

    /** {array<PredicateOp>} Array of operations. */
    this._ops = Object.freeze(ops);

    Object.freeze(this);
  }

  /**
   * {array<PredicateOp>} The predicate operations. This value is always frozen
   * (immutable).
   */
  get ops() {
    return this._ops;
  }

  /**
   * Runs this instance on a given snapshot, indicating whether or not _all_
   * operations are satisfied.
   *
   * @param {FileSnapshot} snapshot Snapshot to test.
   * @returns {boolean} `true` if this instance's predicate operations all pass
   *   on `snapshot`, or `false` if not.
   */
  allPass(snapshot) {
    FileSnapshot.check(snapshot);

    for (const op of this._ops) {
      if (!op.test(snapshot)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Runs this instance on a given snapshot, indicating whether or not _any_
   * operations are satisfied.
   *
   * @param {FileSnapshot} snapshot Snapshot to test.
   * @returns {boolean} `true` if any of this instance's predicate operations
   *   pass on `snapshot`, or `false` if none pass.
   */
  anyPass(snapshot) {
    FileSnapshot.check(snapshot);

    for (const op of this._ops) {
      if (op.test(snapshot)) {
        return true;
      }
    }

    return false;
  }
}
