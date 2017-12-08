// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Errors as FileStoreErrors, StoragePath } from 'file-store';
import { CommonBase, Errors } from 'util-common';

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
     * to provide just enough access for this class to do its work. See
     * {@link file-store.FileOp} where the friend is constructed for
     * documentation on its makeup.
     */
    this._fileFriend = fileFriend;

    /**
     * {Map<string, FrozenBuffer|null>|null} Map from paths retrieved while
     * running the transaction to the retrieved contents, or `null` if the
     * transaction has no data read operations.
     */
    this._data = spec.hasReadOps() ? new Map() : null;

    /**
     * {Set<string>|null} Set of paths listed while running the transaction, or
     * `null` if the transaction has no path-returning operations.
     */
    this._paths = spec.hasPathOps() ? new Set() : null;

    /** {boolean} Whether or not this transaction has any wait operations. */
    this._hasWaitOps = spec.hasWaitOps();

    /**
     * {Map<string, FrozenBuffer|null>} Map from storage IDs updated while
     * running the transaction to the updated data or `null` for deleted
     * entries.
     */
    this._updatedStorage = new Map();

    /**
     * {boolean} Whether any of the wait operations became satisfied during the
     * latest transaction run, and so therefor the transaction completed and
     * doesn't require waiting and retrying. This is set to `false` at the start
     * of `run()` and can become `true` in the various `when*` ops.
     */
    this._waitSatisfied = false;

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

    // This gets set to `true` in wait ops that are satisfied.
    this._waitSatisfied = false;

    // If we have to wait, this is the number we'll report.
    this._waitCount++;

    for (const op of this._spec.ops) {
      this._log.detail('Op:', op);

      const handler = this[`_op_${op.name}`];
      if (!handler) {
        throw Errors.wtf(`Missing handler for op: ${op.name}`);
      }

      handler.call(this, op.props);
    }

    this._log.detail('Transactor done.');
    return this._waitSatisfied || !this._hasWaitOps;
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
   * {Set<string>|null} Set of paths listed while running the transaction, or
   * `null` if the transaction has no path list operations.
   */
  get paths() {
    return this._paths;
  }

  /**
   * {Map<string, FrozenBuffer|null>} Map from paths updated while running the
   * transaction to the updated data or `null` for deleted paths.
   */
  get updatedStorage() {
    return this._updatedStorage;
  }

  /**
   * Handler for `checkBlobAbsent` operations.
   *
   * @param {object} props The operation properties.
   */
  _op_checkBlobAbsent(props) {
    const { hash } = props;

    if (this._fileFriend.readBlobOrNull(hash) !== null) {
      throw FileStoreErrors.blob_not_absent(hash);
    }
  }

  /**
   * Handler for `checkBlobPresent` operations.
   *
   * @param {object} props The operation properties.
   */
  _op_checkBlobPresent(props) {
    const { hash } = props;

    if (this._fileFriend.readBlobOrNull(hash) === null) {
      throw FileStoreErrors.blob_not_found(hash);
    }
  }

  /**
   * Handler for `checkPathAbsent` operations.
   *
   * @param {object} props The operation properties.
   */
  _op_checkPathAbsent(props) {
    const { storagePath } = props;

    if (this._fileFriend.readPathOrNull(storagePath) !== null) {
      throw FileStoreErrors.path_not_absent(storagePath);
    }
  }

  /**
   * Handler for `checkPathIs` operations.
   *
   * @param {object} props The operation properties.
   */
  _op_checkPathIs(props) {
    const { hash: expectedHash, storagePath } = props;
    const data = this._fileFriend.readPathOrNull(storagePath);

    if (data === null) {
      throw FileStoreErrors.path_not_found(storagePath);
    } else if (data.hash !== expectedHash) {
      throw FileStoreErrors.path_hash_mismatch(storagePath, expectedHash);
    }
  }

  /**
   * Handler for `checkPathNot` operations.
   *
   * @param {object} props The operation properties.
   */
  _op_checkPathNot(props) {
    const { hash: unexpectedHash, storagePath } = props;
    const data = this._fileFriend.readPathOrNull(storagePath);

    if ((data !== null) && (data.hash === unexpectedHash)) {
      throw FileStoreErrors.path_hash_mismatch(storagePath, unexpectedHash);
    }
  }

  /**
   * Handler for `checkPathPresent` operations.
   *
   * @param {object} props The operation properties.
   */
  _op_checkPathPresent(props) {
    const { storagePath } = props;

    if (this._fileFriend.readPathOrNull(storagePath) === null) {
      throw FileStoreErrors.path_not_found(storagePath);
    }
  }

  /**
   * Handler for `deleteAll` operations.
   *
   * @param {object} props_unused The operation properties.
   */
  _op_deleteAll(props_unused) {
    for (const [storagePath, value_unused] of this._fileFriend.allStorage()) {
      this._updatedStorage.set(storagePath, null);
    }
  }

  /**
   * Handler for `deleteBlob` operations.
   *
   * @param {object} props The operation properties.
   */
  _op_deleteBlob(props) {
    const { hash } = props;

    if (this._fileFriend.readBlobOrNull(hash) !== null) {
      this._updatedStorage.set(hash, null);
    }
  }

  /**
   * Handler for `deletePath` operations.
   *
   * @param {object} props The operation properties.
   */
  _op_deletePath(props) {
    const { storagePath } = props;

    if (this._fileFriend.readPathOrNull(storagePath) !== null) {
      this._updatedStorage.set(storagePath, null);
    }
  }

  /**
   * Handler for `deletePathPrefix` operations.
   *
   * @param {object} props The operation properties.
   */
  _op_deletePathPrefix(props) {
    const { storagePath: prefix } = props;

    for (const [storagePath, value_unused] of this._fileFriend.pathStorage()) {
      if (StoragePath.isPrefixOrSame(prefix, storagePath)) {
        // We have a match.
        this._updatedStorage.set(storagePath, null);
      }
    }
  }

  /**
   * Handler for `listPathPrefix` operations.
   *
   * @param {object} props The operation properties.
   */
  _op_listPathPrefix(props) {
    const { storagePath: prefix } = props;

    for (const [storagePath, value_unused] of this._fileFriend.pathStorage()) {
      if (StoragePath.isPrefixOrSame(prefix, storagePath)) {
        // We have a prefix match. Strip off components beyond the one
        // immediately under the prefix, if any. (`+1` to skip the slash
        // immediately after the prefix.)
        const nextSlashAt = storagePath.indexOf('/', prefix.length + 1);
        const newPath =
          (nextSlashAt === -1) ? storagePath : storagePath.slice(0, nextSlashAt);
        this._paths.add(newPath);
      }
    }
  }

  /**
   * Handler for `readBlob` operations.
   *
   * @param {object} props The operation properties.
   */
  _op_readBlob(props) {
    const { hash } = props;
    const data     = this._fileFriend.readBlobOrNull(hash);

    if (data !== null) {
      // Per the `FileOp` documentation, we are only supposed to bind a result
      // key if the blob is present.
      this._data.set(hash, data);
    }
  }

  /**
   * Handler for `readPath` operations.
   *
   * @param {object} props The operation properties.
   */
  _op_readPath(props) {
    const { storagePath } = props;
    const data            = this._fileFriend.readPathOrNull(storagePath);

    if (data !== null) {
      // Per the `FileOp` documentation, we are only supposed to bind a result
      // key if the path is present (stores data).
      this._data.set(storagePath, data);
    }
  }

  /**
   * Handler for `readPathRange` operations.
   *
   * @param {object} props The operation properties.
   */
  _op_readPathRange(props) {
    const { storagePath, startInc, endExc } = props;

    for (let i = startInc; i < endExc; i++) {
      const fullPath = `${storagePath}/${i}`;
      const data = this._fileFriend.readPathOrNull(fullPath);

      if (data !== null) {
        // Per the `FileOp` documentation, we are only supposed to bind a result
        // key if the path is present (stores data).
        this._data.set(fullPath, data);
      }
    }
  }

  /**
   * Handler for `revNum` operations. In this implementation, we only ever have
   * a single revision available, and we reject the transaction should it not be
   * the requested restriction.
   *
   * @param {object} props The operation properties.
   */
  _op_revNum(props) {
    const { revNum } = props;

    if (this._fileFriend.revNum !== revNum) {
      throw Errors.revision_not_available(revNum);
    }
  }

  /**
   * Handler for `timeout` operations. In this case, there's nothing to do
   * because the code in `LocalFile` that calls into here already takes care
   * of timeouts.
   *
   * @param {object} props_unused The operation properties.
   */
  _op_timeout(props_unused) {
    // This space intentionally left blank.
  }

  /**
   * Handler for `whenPathAbsent` operations.
   *
   * @param {object} props The operation properties.
   */
  _op_whenPathAbsent(props) {
    const { storagePath } = props;
    const value           = this._fileFriend.readPathOrNull(storagePath);

    if (value === null) {
      this._paths.add(storagePath);
      this._waitSatisfied = true;
    }

    this._logAboutWaiting(`whenPathAbsent: ${storagePath}`);
  }

  /**
   * Handler for `whenPathNot` operations.
   *
   * @param {object} props The operation properties.
   */
  async _op_whenPathNot(props) {
    const { hash, storagePath } = props;
    const value                 = this._fileFriend.readPathOrNull(storagePath);

    if ((value === null) || (value.hash !== hash)) {
      this._paths.add(storagePath);
      this._waitSatisfied = true;
    }

    this._logAboutWaiting(`whenPathNot: ${storagePath}`);
  }

  /**
   * Handler for `whenPathPresent` operations.
   *
   * @param {object} props The operation properties.
   */
  _op_whenPathPresent(props) {
    const { storagePath } = props;
    const value           = this._fileFriend.readPathOrNull(storagePath);

    if (value !== null) {
      this._paths.add(storagePath);
      this._waitSatisfied = true;
    }

    this._logAboutWaiting(`whenPathPresent: ${storagePath}`);
  }

  /**
   * Handler for `writeBlob` operations.
   *
   * @param {object} props The operation properties.
   */
  _op_writeBlob(props) {
    const { value } = props;

    this._updatedStorage.set(value.hash, value);
  }

  /**
   * Handler for `writePath` operations.
   *
   * @param {object} props The operation properties.
   */
  _op_writePath(props) {
    const { storagePath, value } = props;

    this._updatedStorage.set(storagePath, value);
  }

  /**
   * Helper for the `when*` ops, which logs information about waiting or the
   * lack thereof, based on the value of `_waitSatisfied` and `_waitCount`.
   *
   * @param {string} message Additional message to include.
   */
  _logAboutWaiting(message) {
    if (this._waitSatisfied) {
      if (this._waitCount === 1) {
        this._log.info('No waiting required.', message);
      } else {
        this._log.info('Done waiting.', message);
      }
    } else {
      if (this._waitCount === 1) {
        this._log.info('Waiting.', message);
      } else {
        this._log.info(`Wait #${this._waitCount}.`, message);
      }
    }
  }

  /**
   * Indicate a missing op implementation. **TODO:** Fix all these!
   *
   * @param {string} name Name of the missing op.
   */
  static _missingOp(name) {
    throw Errors.wtf(`Missing op implementation: ${name}`);
  }
}
