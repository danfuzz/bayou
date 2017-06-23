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

    /** {Map<string,Set<FileOp>>} Per-category sets of operations. */
    const catSets = this._categorySets = new Map();

    for (const op of ops) {
      FileOp.check(op);

      let catSet = catSets.get(op.category);
      if (catSet === undefined) {
        catSet = new Set();
        catSets.set(op.category, catSet);
      }

      catSet.add(op);
    }
  }

  /**
   * Gets an iterator for the operations of the indicated category.
   *
   * **Note:** We return an iterator and not (say) a `Set` because the latter
   * can't be made immutable, and so returning them would force us to make a
   * duplicate. Iterators, on the other hand, by their nature do not expose any
   * ability to mutate the underlying collection.
   *
   * @param {string} category The category to get.
   * @returns {Iterator<FileOp>} Iterator over all of the operations of the
   *   given category.
   */
  opsFor(category) {
    FileOp.validateCategory(category);

    const catSet = this._categorySets.get(category);
    return (catSet || []).values();
  }
}
