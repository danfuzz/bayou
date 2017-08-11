// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Errors } from 'content-store';
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
     * Properties and methods on this are defined in an ad-hoc manner intended
     * to provide just enough access for this class to do its work. See `FileOp`
     # where the friend is constructed for documentation on its makeup.
     */
    this._fileFriend = fileFriend;

    /**
     * {Map<string, FrozenBuffer|null>|null} Map from paths retrieved while
     * running the transaction to the retrieved contents, or `null` if the
     * transaction has no data read operations.
     */
    this._data = spec.hasReadOps() ? new Map() : null;

    /**
     * {Map<string, FrozenBuffer|null>} Map from paths updated while running the
     * transaction to the updated data or `null` for deleted paths.
     */
    this._updatedStorage = new Map();

    /**
     * {boolean} Whether the transaction completed and doesn't require waiting
     * and retrying. This is set to `true` at the start of `run()` and can
     * become `false` in the various `when*` ops.
     */
    this._completed = true;

    /**
     * {Int} How many times a wait operation has been required. This is just
     * used to provide more informative logging messages in the `when*` ops.
     */
    this._waitCount = 0;

    /** {Logger} Logger to use. */
    this._log = fileFriend.log;

    this._log.detail('Transactor constructed.');
  }

  /**
   * Runs the transaction.
   *
   * @returns {boolean} Completion / retry flag. `true` if the transaction ran
   *   to completion, or `false` if the transaction hasn't been completed and
   *   needs to be retried after waiting for a file change.
   */
  run() {
    this._log.detail('Transactor running.');

    // This gets set to `false` if one of the ops determines that we need to
    // wait for a change.
    this._completed = true;

    for (const op of this._spec.ops) {
      this._log.detail('Op:', op);

      const handler = this[`_op_${op.name}`];
      if (!handler) {
        throw InfoError.wtf(`Missing handler for op: ${op.name}`);
      }

      handler.call(this, op);
    }

    this._log.detail('Transactor done.');
    return this._completed;
  }

  /**
   * {Map<string, FrozenBuffer|null>|null} Map from paths retrieved while
   * running the transaction to the retrieved contents, or `null` if the
   * transaction has no data read operations.
   */
  get data() {
    return this._data;
  }

  /**
   * {Map<string, FrozenBuffer|null>} Map from paths updated while running the
   * transaction to the updated data or `null` for deleted paths.
   */
  get updatedStorage() {
    return this._updatedStorage;
  }

  /**
   * Handler for `checkBlob` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_checkBlob(op) {
    // **TODO:** Implement this.
    Transactor._missingOp(op.name);
  }

  /**
   * Handler for `checkBlobAbsent` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_checkBlobAbsent(op) {
    // **TODO:** Implement this.
    Transactor._missingOp(op.name);
  }

  /**
   * Handler for `checkPathAbsent` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_checkPathAbsent(op) {
    const storagePath = op.arg('storagePath');
    if (this._fileFriend.readPathOrNull(storagePath) !== null) {
      throw Errors.path_not_absent(storagePath);
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
      throw Errors.path_not_found(storagePath);
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
      throw Errors.path_not_found(storagePath);
    } else if (data.hash !== expectedHash) {
      throw Errors.path_hash_mismatch(storagePath, expectedHash);
    }
  }

  /**
   * Handler for `deleteAll` operations.
   *
   * @param {FileOp} op_unused The operation.
   */
  _op_deleteAll(op_unused) {
    for (const [path, value_unused] of this._fileFriend.pathStorage()) {
      this._updatedStorage.set(path, null);
    }
  }

  /**
   * Handler for `deleteBlob` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_deleteBlob(op) {
    // **TODO:** Implement this.
    Transactor._missingOp(op.name);
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
   * Handler for `readBlob` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_readBlob(op) {
    // **TODO:** Implement this.
    Transactor._missingOp(op.name);
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
   * Handler for `revNum` operations. In this implementation, we only ever have
   * a single revision available, and we reject the transaction should it not be
   * the requested restriction.
   *
   * @param {FileOp} op The operation.
   */
  _op_revNum(op) {
    const revNum = op.arg('revNum');

    if (this._fileFriend.revNum !== revNum) {
      throw Errors.revision_not_available(revNum);
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
   * Handler for `whenPath` operations.
   *
   * @param {FileOp} op The operation.
   */
  async _op_whenPath(op) {
    const storagePath = op.arg('storagePath');
    const hash        = op.arg('hash');
    const value       = this._fileFriend.readPathOrNull(storagePath);

    if ((value !== null) && (value.hash === hash)) {
      this._completed = false;
      this._waitCount++;
      if (this._waitCount === 1) {
        this._log.info(`Waiting for path: ${storagePath}`);
      } else {
        this._log.info(`Wait #${this._waitCount} for path: ${storagePath}`);
      }
    } else {
      if (this._waitCount === 0) {
        this._log.info(`No waiting required for path: ${storagePath}`);
      } else {
        this._log.info(`Done waiting for path: ${storagePath}`);
      }
    }
  }

  /**
   * Handler for `whenPathAbsent` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_whenPathAbsent(op) {
    // **TODO:** Implement this.
    Transactor._missingOp(op.name);
  }

  /**
   * Handler for `writeBlob` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_writeBlob(op) {
    // **TODO:** Implement this.
    Transactor._missingOp(op.name);
  }

  /**
   * Handler for `writePath` operations.
   *
   * @param {FileOp} op The operation.
   */
  _op_writePath(op) {
    this._updatedStorage.set(op.arg('storagePath'), op.arg('value'));
  }

  /**
   * Indicate a missing op implementation. **TODO:** Fix all these!
   *
   * @param {string} name Name of the missing op.
   */
  static _missingOp(name) {
    throw InfoError.wtf(`Missing op implementation: ${name}`);
  }
}
