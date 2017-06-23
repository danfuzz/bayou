// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';
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

    // Validate the restriction on timeouts.
    if (this.opsWithName('timeout').length > 1) {
      throw new Error('Too many `timeout` operations.');
    }
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

  /**
   * {Int|null} The timeout duration in milliseconds, or `null` if this
   * transaction specifies no timeout.
   */
  get timeoutMsec() {
    const result = this.opsWithName('timeout')[0];
    return (result === undefined) ? null : result;
  }

  /**
   * Gets all of the operations with the given category.
   *
   * @param {string} category Category of the operations.
   * @returns {array<FileOp>} Array of all such operations.
   */
  opsWithCategory(category) {
    FileOp.validateCategory(category);
    return this._ops.filter(op => (op.category === category));
  }

  /**
   * Gets all of the operations with the given Name.
   *
   * @param {string} name Name of the operations.
   * @returns {array<FileOp>} Array of all such operations.
   */
  opsWithName(name) {
    TString.nonempty(name);
    return this._ops.filter(op => (op.name === name));
  }
}
