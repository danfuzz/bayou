// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

/**
 * Handler for `LocalFile.transact()`. An instance of this class is constructed
 * for each call to that method. Its `run()` method is what does most of the
 * work of performing the transaction.
 *
 * The class defines a method named `_op_<name>` for each of the named `FileOp`s
 * that this class knows how to handle (which is hopefully all of them, but
 * perhaps at times there will be something missing...or extra).
 */
export default class Transactor extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {TransactionSpec} spec The transaction specification.
   * @param {object} fileFriend "Friend" access to the `LocalFile` which spawned
   *   this instance. See below for more info.
   */
  constructor(spec, fileFriend) {
    super();

    /** {TransactionSpec} spec The transaction specification. */
    this._spec = spec;

    /**
     * {object} "Friend" access to the `LocalFile` that spawned this instance.
     * Properties and methods on this are defined in an ad-hoc
     * manner intended to provide just enough access for this class to do its
     * work. See `FileOp` where the friend is constructed for documentation on
     * its makeup.
     */
    this._fileFriend = fileFriend;

    /** {Logger} Logger to use. */
    this._log = fileFriend.log;

    this._log.detail('Transactor constructed.');
  }

  /**
   * Runs the transaction.
   *
   * @returns {object} `_impl_transact()` result as defined by `BaseFile`.
   */
  run() {
    this._log.detail('Transactor running.');

    // Handle the operation categories in the prescribed order.

    const spec      = this._spec;
    const revNum    = this._fileFriend.revNum;
    const newRevNum = null;
    const data      = null;

    for (const op of spec.ops) {
      this._log.detail('Op:', op);
      // TODO: Should actually do stuff.
      throw new Error('TODO');
    }

    this._log.detail('Transactor complete.');
    return { revNum, newRevNum, data };
  }

  /**
   * Handler for `checkPathEmpty` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_checkPathEmpty(op) {
    this._log.info('TODO', op);
    throw new Error('TODO');
  }

  /**
   * Handler for `checkPathExists` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_checkPathExists(op) {
    this._log.info('TODO', op);
    throw new Error('TODO');
  }

  /**
   * Handler for `checkPathHash` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_checkPathHash(op) {
    this._log.info('TODO', op);
    throw new Error('TODO');
  }

  /**
   * Handler for `deletePath` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_deletePath(op) {
    this._log.info('TODO', op);
    throw new Error('TODO');
  }

  /**
   * Handler for `maxRevNum` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_maxRevNum(op) {
    this._log.info('TODO', op);
    throw new Error('TODO');
  }

  /**
   * Handler for `minRevNum` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_minRevNum(op) {
    this._log.info('TODO', op);
    throw new Error('TODO');
  }

  /**
   * Handler for `readPath` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_readPath(op) {
    this._log.info('TODO', op);
    throw new Error('TODO');
  }

  /**
   * Handler for `timeout` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_timeout(op) {
    this._log.info('TODO', op);
    throw new Error('TODO');
  }

  /**
   * Handler for `writePath` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_writePath(op) {
    this._log.info('TODO', op);
    throw new Error('TODO');
  }
}
