// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { FileOp } from 'content-store';
import { CommonBase, InfoError } from 'util-common';

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
   * Handler for `checkBlobHash` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_checkBlobHash(op) {
    // **TODO:** Implement this.
    throw new InfoError('not_implemented', op.name);
  }

  /**
   * Handler for `checkPathEmpty` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_checkPathEmpty(op) {
    const storagePath = op.arg('storagePath');
    if (this._fileFriend.readPathOrNull(storagePath) !== null) {
      throw new InfoError('path_not_empty', storagePath);
    }
  }

  /**
   * Handler for `checkPathExists` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_checkPathExists(op) {
    const storagePath = op.arg('storagePath');
    if (this._fileFriend.readPathOrNull(storagePath) === null) {
      throw new InfoError('path_not_found', storagePath);
    }
  }

  /**
   * Handler for `checkPathHash` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_checkPathHash(op) {
    const storagePath  = op.arg('storagePath');
    const expectedHash = op.arg('hash');
    const data         = this._fileFriend.readPathOrNull(storagePath);

    if (data === null) {
      throw new InfoError('path_not_found', storagePath);
    } else if (data.hash !== expectedHash) {
      throw new InfoError('path_hash_mismatch', storagePath, expectedHash);
    }
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
   * Handler for `maxRevNum` operations. In this implementation, we only ever
   * have a single revision available, and we reject the transaction should it
   * not be covered by the requested restriction.
   *
   * @param {FileOp} op The operation.
   */
  _op_maxRevNum(op) {
    const revNum = op.arg('revNum');

    // **Note:** `>=` because the op is for an exclusive (not inclusive)
    // maximum.
    if (this._fileFriend.revNum >= revNum) {
      throw new InfoError('revision_not_available', 'max', revNum);
    }
  }

  /**
   * Handler for `minRevNum` operations. In this implementation, we only ever
   * have a single revision available, and we reject the transaction should it
   * not be covered by the requested restriction.
   *
   * @param {FileOp} op The operation.
   */
  _op_minRevNum(op) {
    const revNum = op.arg('revNum');

    if (this._fileFriend.revNum < revNum) {
      throw new InfoError('revision_not_available', 'min', revNum);
    }
  }

  /**
   * Handler for `readBlob` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_readBlob(op) {
    // **TODO:** Implement this.
    throw new InfoError('not_implemented', op.name);
  }

  /**
   * Handler for `readPath` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_readPath(op) {
    const storagePath = op.arg('storagePath');
    const data        = this._fileFriend.readPathOrNull(storagePath);

    if (data !== null) {
      // Per the `FileOp` documentation, we are _not_ supposed to bind result
      // data if the path isn't found.
      this._data.set(storagePath, data);
    }
  }

  /**
   * Handler for `timeout` operations. In this case, there's nothing to do
   * because the code in `LocalFile` that calls into here already takes care
   * of timeouts.
   *
   * @param {FileOp} op_unused The operation.
   */
  _op_timeout(op_unused) {
    // This space intentionally left blank.
  }

  /**
   * Handler for `writeBlob` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_writeBlob(op) {
    // **TODO:** Implement this.
    throw new InfoError('not_implemented', op.name);
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
