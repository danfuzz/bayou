// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { FileOp } from 'content-store';
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

    /**
     * {Map<string,FrozenBuffer|null>|null} Map from paths retrieved while
     * running the transaction to the retrieved contents, or `null` if the
     * transaction has no data read operations.
     */
    this._data = (spec.opsWithCategory(FileOp.CAT_READ).size === 0)
      ? null
      : new Map();

    /**
     * {Map<string,FrozenBuffer|null>} Map from paths updated while running the
     * transaction to the updated data or `null` for deleted paths.
     */
    this._updatedStorage = new Map();

    /** {Logger} Logger to use. */
    this._log = fileFriend.log;

    this._log.detail('Transactor constructed.');
  }

  /**
   * Runs the transaction.
   *
   * @returns {object} Object that binds `data` to a
   *   `{Map<string,FrozenBuffer|null>}` of retrieved data and `updatedStorage`
   *   to a `{Map<string,FrozenBuffer|null>}` of updated storage (paths to be
   *   written or deleted).
   */
  run() {
    this._log.detail('Transactor running.');

    for (const op of this._spec.ops) {
      this._log.detail('Op:', op);

      const handler = this[`_op_${op.name}`];
      if (!handler) {
        throw new Error(`Missing handler for op: ${op.name}`);
      }

      handler.call(this, op);
    }

    this._log.detail('Transactor done.');
    return {
      data:           this._data,
      updatedStorage: this._updatedStorage
    };
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
    this._updatedStorage.set(op.arg('storagePath'), null);
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
    this._updatedStorage.set(op.arg('storagePath'), op.arg('value'));
  }
}
