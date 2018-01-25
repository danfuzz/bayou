// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase, Errors } from 'util-common';

import FileSnapshot from './FileSnapshot';
import PredicateSpec from './PredicateSpec';
import TransactionOp from './TransactionOp';

/**
 * Transaction specification. This is a set of operations (each an instance of
 * `TransactionOp`) which are to be executed with regard to a file, as an atomic
 * unit. See `TransactionOp` for more information about the possible operations
 * and how they get executed.
 */
export default class TransactionSpec extends CommonBase {
  /**
   * Constructs an instance consisting of all of the indicated operations.
   *
   * @param {...TransactionOp} ops The operations to perform.
   */
  constructor(...ops) {
    super();

    /** {array<TransactionOp>} Category-sorted array of operations. */
    this._ops = Object.freeze(TransactionOp.sortByCategory(ops));

    // Validate the op combo restrictions.

    if (this.opsWithName('timeout').length > 1) {
      throw Errors.badUse('Too many `timeout` operations.');
    }

    if (this.opsWithCategory(TransactionOp.CAT_wait).length > 1) {
      throw Errors.badUse('Too many `wait` operations.');
    }

    if ((this.hasWaitOps() + this.hasPullOps() + this.hasPushOps()) > 1) {
      throw Errors.badUse('Must only have one of wait operations, pull operations, or push operations.');
    }

    Object.freeze(this);
  }

  /**
   * {array<TransactionOp>} The operations to perform. These are in
   * category-sorted order, as documented by `TransactionOp`. This value is
   * always frozen (immutable).
   */
  get ops() {
    return this._ops;
  }

  /**
   * {Int|'never'} The timeout duration in milliseconds, or the string `'never'`
   * if this transaction specifies no timeout.
   */
  get timeoutMsec() {
    const result = this.opsWithName('timeout')[0];
    return (result === undefined) ? 'never' : result.props.durMsec;
  }

  /**
   * Concatenates the operations of this instance with that of another instance.
   * Returns a new instance of this class with the combined operations.
   *
   * @param {TransactionSpec} other Instance to concatenate with.
   * @returns {TransactionSpec} Instance with the operations of both `this` and
   *   `other`.
   */
  concat(other) {
    TransactionSpec.check(other);

    const ops = this._ops.concat(other._ops);
    return new TransactionSpec(...ops);
  }

  /**
   * Indicates whether or not this instance has any operations which return
   * path results, that is, any operations with category `CAT_list` or
   * `CAT_wait`.
   *
   * @returns {boolean} `true` iff there are any push operations in this
   *   instance.
   */
  hasPathOps() {
    return (this.opsWithCategory(TransactionOp.CAT_list).length !== 0)
      || (this.opsWithCategory(TransactionOp.CAT_wait).length !== 0);
  }

  /**
   * Indicates whether or not this instance has any push operations (data
   * storage of any sort), that is, any operations with category `CAT_delete` or
   * `CAT_write`.
   *
   * @returns {boolean} `true` iff there are any push operations in this
   *   instance.
   */
  hasPushOps() {
    return (this.opsWithCategory(TransactionOp.CAT_delete).length !== 0)
      || (this.opsWithCategory(TransactionOp.CAT_write).length !== 0);
  }

  /**
   * Indicates whether or not this instance has any pull operations (data
   * retrieval of any sort), that is, any operations with category `CAT_list` or
   * `CAT_read`.
   *
   * @returns {boolean} `true` iff there are any pull operations in this
   *   instance.
   */
  hasPullOps() {
    return (this.opsWithCategory(TransactionOp.CAT_list).length !== 0)
      || (this.opsWithCategory(TransactionOp.CAT_read).length !== 0);
  }

  /**
   * Indicates whether or not this instance has any read operations, that is,
   * any operations with category `CAT_read`.
   *
   * @returns {boolean} `true` iff there are any read operations in this
   *   instance.
   */
  hasReadOps() {
    return this.opsWithCategory(TransactionOp.CAT_read).length !== 0;
  }

  /**
   * Indicates whether or not this instance has any wait operations, that is,
   * any operations with category `CAT_wait`.
   *
   * @returns {boolean} `true` iff there are any wait operations in this
   *   instance.
   */
  hasWaitOps() {
    return this.opsWithCategory(TransactionOp.CAT_wait).length !== 0;
  }

  /**
   * Gets all of the operations with the given category.
   *
   * @param {string} category Category of the operations.
   * @returns {array<TransactionOp>} Array of all such operations.
   */
  opsWithCategory(category) {
    TransactionOp.checkCategory(category);
    return this._ops.filter(op => (op.category === category));
  }

  /**
   * Gets all of the operations with the given Name.
   *
   * @param {string} name Name of the operations.
   * @returns {array<TransactionOp>} Array of all such operations.
   */
  opsWithName(name) {
    // This validates the name.
    TransactionOp.propsFromName(name);

    return this._ops.filter(op => (op.name === name));
  }

  /**
   * Runs this instance's prerequisites, throwing an error if any are not
   * satisfied.
   *
   * @param {FileSnapshot} snapshot Snapshot to operate on.
   */
  runPrerequisites(snapshot) {
    FileSnapshot.check(snapshot);

    const origOps   = this.opsWithCategory(TransactionOp.CAT_prerequisite);
    const ops       = origOps.map(op => op.toPredicateOp());
    const predicate = new PredicateSpec(...ops);

    predicate.throwIfNotAllPass(snapshot);
  }

  /**
   * Runs this instance as a "pull" transaction. This includes first testing
   * prerequisites and then gathering the data as indicated by pull operations.
   * If a prerequisite fails, this method will throw an error.
   *
   * @param {FileSnapshot} snapshot Snapshot to operate on.
   * @returns {object} Plain object which maps `data` and `paths` as defined
   *   by {@link file-store.BaseFile#transact}.
   */
  runPull(snapshot) {
    FileSnapshot.check(snapshot);

    this.runPrerequisites(snapshot);

    // Arrangement to keep the linter happy, even though this always throws.
    if (snapshot !== null) throw Errors.wtf('TODO');
    else return null;
  }

  /**
   * Runs this instance as a "push" transaction. This includes first testing
   * prerequisites and then producing a change which can be composed with the
   * given snapshot to achieve the effect of this instance's push operations.
   * If a prerequisite fails, this method will throw an error.
   *
   * @param {FileSnapshot} snapshot Snapshot to operate on.
   * @returns {FileChange} Change which can be composed with `snapshot` that has
   *   the effect of this instance's push operations.
   */
  runPush(snapshot) {
    FileSnapshot.check(snapshot);

    this.runPrerequisites(snapshot);

    // Arrangement to keep the linter happy, even though this always throws.
    if (snapshot !== null) throw Errors.wtf('TODO');
    else return null;
  }

  /**
   * Runs this instance as a "wait" transaction. This includes first testing
   * prerequisites and then returning a value which indicates whether the wait
   * condition (as encoded by the wait operation of this instance) is satisfied
   * by the given snapshot. If a prerequisite fails, this method will throw an
   * error.
   *
   * @param {FileSnapshot} snapshot Snapshot to operate on.
   * @returns {string|null} The storage ID which caused the wait transaction to
   *   be satisfied, or _null_ if the transaction is not in fact satisfied.
   */
  runWait(snapshot) {
    FileSnapshot.check(snapshot);

    const waitOps = this.opsWithCategory(TransactionOp.CAT_wait);

    if (waitOps.length === 0) {
      throw Errors.badUse('Not a wait transaction.');
    } else if (waitOps.length > 1) {
      // The `TransactionSpec` constructor should have guaranteed that this is
      // not the case.
      throw Errors.wtf('Can\'t handle more than one wait operation!');
    }

    const predicateOp = waitOps[0].toPredicateOp();

    this.runPrerequisites(snapshot);

    if (predicateOp.test(snapshot)) {
      // Wait condition was satisfied. If the op has a `path` then that's the
      // storage ID result; otherwise it's its `hash`. (There are no other
      // possibilities.)
      const { path, hash } = predicateOp.props;
      return path || hash;
    } else {
      // Wait condition not satisfied.
      return null;
    }
  }
}
