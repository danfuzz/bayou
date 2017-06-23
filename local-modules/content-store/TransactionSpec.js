// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

import FileOp from './FileOp';

/**
 * Transaction specification. This is a set of operations (each an instance of
 * `FileOp`) which are to be executed with regard to a file, as an atomic unit.
 * See `FileOp` for more information about the possible operations and how they
 * get executed.
 */
export default class TransactionSpec extends CommonBase {
  /**
   * Constructs an instance consisting of all of the indicated operations.
   *
   * @param {...FileOp} ops The operations to perform.
   */
  constructor(...ops) {
    super();

    /** {array<FileOp>} Category-sorted array of operations. */
    this._ops = FileOp.sortByCategory(ops);
  }

  /**
   * {Iterator<FileOp>} An iterator for the operations to perform. The
   * operations are yielded by the iterator in category-sorted order, as
   * documented by `FileOp`.
   *
   * **Note:** This is an iterator and not (say) an array so as to make it
   * obvious that the contents are immutable.
   */
  get ops() {
    return this._ops[Symbol.iterator];
  }
}
