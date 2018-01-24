// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import afs from 'async-file';
import path from 'path';

import { Codec } from 'codec';
import { BaseFile } from 'file-store';
import { FileChange, FileSnapshot } from 'file-store-ot';
import { RevisionNumber } from 'ot-common';
import { Condition, Delay, Mutex } from 'promise-util';
import { Logger } from 'see-all';
import { FrozenBuffer, Errors } from 'util-common';

/** {Logger} Logger for this module. */
const log = new Logger('local-file');

/**
 * {Int} How long to wait (in msec) after a file becomes dirty and before it
 * gets written to disk. This keeps the system from thrashing the disk while
 * a file is being actively updated.
 */
const DIRTY_DELAY_MSEC = 5 * 1000; // 5 seconds.

/** {number} Maximum number of simultaneous FS calls to issue in parallel. */
const MAX_PARALLEL_FS_CALLS = 20;

/**
 * File implementation that stores everything in the locally-accessible
 * filesystem.
 */
export default class LocalFile extends BaseFile {
  /**
   * Constructs an instance.
   *
   * @param {string} fileId The ID of the file this instance represents.
   * @param {string} filePath The filesystem path for file storage.
   * @param {Codec} codec Codec instance to use when encoding and decoding
   *   changes.
   */
  constructor(fileId, filePath, codec) {
    super(fileId);

    /**
     * {Codec} Codec instance to use when encoding and decoding items for
     * storage.
     */
    this._codec = Codec.check(codec);

    /**
     * {string} Path to the directory containing stored values for this file.
     */
    this._storageDir = filePath;

    /**
     * {Int|null} Current file revision number or `null` if not yet initialized.
     * This is `-1` for an initialized file with no changes.
     */
    this._revNum = null;

    /**
     * {array<FileChange>} Array of all changes to the file, indexed by revision
     * number.
     */
    this._changes = [];

    /**
     * {FileSnapshot|null} Cached snapshot, or `null` if none is as yet
     * computed.
     */
    this._snapshot = null;

    /**
     * {boolean|null} Whether the file should exist as of the next write. This
     * is used to drive initial file creation, file deletion, and tests of file
     * existence. `null` indicates that the value is not yet initialized.
     */
    this._fileShouldExist = null;

    /**
     * {Map<Int, FrozenBuffer>} Map from revision numbers to corresponding
     * data which has yet to be written to disk.
     */
    this._storageToWrite = new Map();

    /**
     * {boolean} Whether or not there is any current need to write stored values
     * to disk. This is set to `true` when updates are made and back to `false`
     * once the writing has been done.
     */
    this._storageIsDirty = false;

    /**
     * {Promise<true>|null} Promise which resolves to `true` if `_changes` is
     * fully initialized with respect to the stored state. Becomes non-`null`
     * during the first call to `_readStorageIfNecessary()`. It is used to
     * prevent superfluous re-reading of the storage directory.
     */
    this._storageReadyPromise = null;

    /**
     * {Mutex} Mutex that guards file writing operations, so that we only
     * ever have one set of writes in flight at any given time.
     */
    this._writeMutex = new Mutex();

    /**
     * Condition that transitions from `false` to `true` when there is a
     * revision change and there are waiters for same. This remains `true` in
     * the steady state (when there are no waiters). As soon as the first waiter
     * comes along, it gets set to `false`.
     */
    this._changeCondition = new Condition(true);

    /** {Logger} Logger specific to this file's ID. */
    this._log = log.withAddedContext(fileId);

    this._log.info('Path:', this._storageDir);
  }

  /**
   * {Int} Value as required by the superclass. It is defined to be one minute
   * here not because of any inherent time limit in the implementation, but
   * just to make the limit small enough to be easily observable when testing.
   * (Keep in mind that this module is oriented toward development time, not
   * production.)
   */
  get maxTimeoutMsec() {
    return 1 * 60 * 1000; // One minute.
  }

  /**
   * {Int} Value as required by the superclass. It is defined to be 100msec
   * here, for reasons similar to as described in `maxTimeoutMsec` above.
   */
  get minTimeoutMsec() {
    return 100;
  }

  /**
   * Implementation as required by the superclass.
   */
  async _impl_create() {
    await this._readStorageIfNecessary();

    if (!this._fileShouldExist) {
      // Indicate that the file should exist.
      this._fileShouldExist = true;

      // Get it written out.
      this._storageNeedsWrite();
    }
  }

  /**
   * Implementation as required by the superclass.
   */
  async _impl_delete() {
    await this._readStorageIfNecessary();

    if (this._fileShouldExist) {
      // Indicate that the file should not exist, and reset the storage (to be
      // ready for potential re-creation).
      this._fileShouldExist = false;
      this._revNum          = 0;
      this._changes         = [];
      this._snapshot        = null;

      // Get it erased.
      this._storageNeedsWrite();
    }
  }

  /**
   * Implementation as required by the superclass.
   *
   * @returns {boolean} `true` iff this file exists.
   */
  async _impl_exists() {
    await this._readStorageIfNecessary();

    return this._fileShouldExist;
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {TransactionSpec} spec Same as with `transact()`.
   * @returns {object} Same as with `transact()`, except with `null`s instead of
   *   missing properties.
   */
  async _impl_transact(spec) {
    this._log.detail('Transaction:', spec);

    // Arrange for timeout. **Note:** Needs to be done _before_ possibly reading
    // storage, as that (potential) storage read can take significant time.
    const timeoutMsec = this.clampTimeoutMsec(spec.timeoutMsec);
    let timeout = false; // Gets set to `true` when the timeout expires.
    const timeoutProm = Delay.resolve(timeoutMsec);
    (async () => {
      await timeoutProm;
      timeout = true;
    })();

    await Promise.race([this._readStorageIfNecessary(), timeoutProm]);
    if (timeout) {
      throw Errors.timedOut(timeoutMsec);
    }

    if (!this._fileShouldExist) {
      throw Errors.fileNotFound(this.id);
    }

    // Per the spec / docs, a `TransactionSpec` only has one of pull, push, or
    // wait ops. So, we can safely dispatch to a category-specific handler here.

    if (spec.hasPullOps()) {
      const snapshot = this._currentSnapshot;
      const result   = spec.runPull(snapshot);

      // Add the properties required by the `_impl_transact()` contract.
      result.newRevNum = null;
      result.revNum    = snapshot.revNum;

      return result;
    } else if (spec.hasPushOps()) {
      const snapshot = this._currentSnapshot;
      const change   = spec.runPush(snapshot);

      this._storageToWrite.set(change.revNum, change);
      this._storageNeedsWrite();

      // Form the return value as required by the `_impl_transact()` contract.
      return {
        data:      null,
        newRevNum: change.revNum,
        paths:     null,
        revNum:    snapshot.revNum
      };
    }

    // It's a wait transaction, so we need to be prepared to loop / retry
    // (until satisfaction or timeout).

    for (;;) {
      const snapshot   = this._currentSnapshot;
      const pathResult = spec.runWait(snapshot);

      if (path !== null) {
        // Form the return value as required by the `_impl_transact()` contract.
        return {
          data:      null,
          newRevNum: null,
          paths:     new Set([pathResult]),
          revNum:    snapshot.revNum
        };
      }

      // Force the `_changeCondition` to `false` (though it might already be
      // so set; innocuous if so), and wait either for it to become `true`
      // (that is, wait for _any_ change to the file) or for timeout to occur.
      this._changeCondition.value = false;
      await Promise.race([this._changeCondition.whenTrue(), timeoutProm]);
      if (timeout) {
        throw Errors.timedOut(timeoutMsec);
      }

      // Have to re-check for file existence, as the file could have been
      // deleted while we were waiting.
      if (!this._fileShouldExist) {
        throw Errors.fileNotFound(this.id);
      }
    }
  }

  /**
   * {Int} Current revision number.
   */
  get _currentRevNum() {
    return this._changes.length - 1;
  }

  /**
   * {FileSnapshot} Snapshot of the current revision.
   */
  get _currentSnapshot() {
    const revNum  = this._currentRevNum;
    const changes = this._changes;
    const already = this._snapshot;

    if (already && already.revNum === revNum) {
      return already;
    }

    const [base, startAt] = already
      ? [already,            already.revNum + 1]
      : [FileSnapshot.EMPTY, 0];

    let result = base;
    for (let i = startAt; i <= revNum; i++) {
      result = result.compose(changes[i]);
    }

    this._snapshot = result;
    this._log.info(`Made snapshot for revision: ${revNum}`);

    return result;
  }

  /**
   * Reads the file storage if it has not yet been loaded.
   */
  async _readStorageIfNecessary() {
    if (this._storageReadyPromise === null) {
      // This is the first time the storage has been requested. Initiate a read.
      this._storageReadyPromise = this._readStorage();
    }

    // Wait for the pending read to complete.
    await this._storageReadyPromise;
  }

  /**
   * Reads the storage directory, initializing `_changes`. If the directory
   * doesn't exist, this will initialize the in-memory model with empty contents
   * but does _not_ mark the storage as dirty.
   *
   * @returns {Promise<true>} Promise that resolves once the storage has been
   *   successfully read into memory.
   */
  async _readStorage() {
    if (!await afs.exists(this._storageDir)) {
      // Directory doesn't actually exist. Just initialize empty storage.
      this._fileShouldExist = false;
      this._revNum          = -1;
      this._changes         = [];
      this._snapshot        = null;

      this._changeCondition.value = true;

      this._log.info('New storage.');
      return true;
    }

    // The directory exists. Read its contents.
    this._log.info('Reading storage from disk...');

    const codec   = this._codec;
    const files   = await afs.readdir(this._storageDir);
    const changes = [];

    // This gets called to await on a chunk of FS reads at a time, storing them
    // into `changes`. It's called from the main loop immediately below.
    const storeBufs = async (bufProms) => {
      this._log.detail(`Completed ${bufProms.size} FS read operations(s).`);
      for (const [n, bufProm] of bufProms) {
        const buf    = await bufProm;
        const fbuf   = new FrozenBuffer(buf);
        const change = FileChange.check(codec.decodeJsonBuffer(fbuf));

        if (n !== change.revNum) {
          throw Errors.badData(`Name / data mismatch for alleged revision number ${n}; found ${change.revNum}.`);
        }

        changes[n] = change;
        this._log.info('Read change:', change.revNum);
      }
    };

    // Loop over all the files, requesting their contents, and waiting for
    // a chunk of them at a time.
    const bufPromMap = new Map();
    for (const f of files) {
      const n       = LocalFile._revNumFromFsPath(f);
      const bufProm = afs.readFile(path.resolve(this._storageDir, f));

      bufPromMap.set(n, bufProm);

      if (bufPromMap.size >= MAX_PARALLEL_FS_CALLS) {
        await storeBufs(bufPromMap);
      }
    }

    // Get the remaining partial chunks' worth of bufs, if any.
    if (bufPromMap.size !== 0) {
      await storeBufs(bufPromMap);
    }

    this._log.info('Done reading storage.');

    // Validate that there are no holes, and set up `revNum`.

    if (files.length !== changes.length) {
      // Hole!
      throw Errors.badData('Missing at least one change.');
    }

    const revNum = changes.length - 1;
    this._log.info('Starting revision number:', revNum);

    // Only set the instance variables after all the reading is done and the
    // current revision number is known.
    this._fileShouldExist = true;
    this._revNum          = revNum;
    this._changes         = changes;
    this._snapshot        = null;
    this._storageToWrite  = new Map();
    this._storageIsDirty  = false;

    // This wakes up wait transactions, if any, which can then go about figuring
    // out if they're satisfied.
    this._changeCondition.value = true;

    return true;
  }

  /**
   * Indicates that there is file state that needs to be written to disk. This
   * method acts (and returns) promptly. It will kick off a timed callback to
   * actually perform any needed writing operation(s) if one isn't already
   * pending. In addition, it flips `_changeCondition` to `true` (if not
   * already set as such), which unblocks code that was awaiting any changes.
   */
  _storageNeedsWrite() {
    // Release anything awaiting a change.
    this._changeCondition.value = true;

    if (this._storageIsDirty) {
      // Already marked dirty, which means there's nothing more to do. When
      // the already-scheduled timer fires, it will pick up the current change.
      this._log.detail('Storage already marked dirty.');
      return;
    }

    // Mark the storage dirty, and queue up the writer.
    this._storageIsDirty = true;
    this._waitThenWriteStorage();
  }

  /**
   * Waits for a moment, and then writes the then-current dirty storage.
   * The return value becomes resolved once writing is complete.
   *
   * @returns {true} `true`, upon successful writing.
   */
  async _waitThenWriteStorage() {
    this._log.info('Storage modified. Waiting a moment for further changes.');

    // Wait for the prescribed amount of time.
    await Delay.resolve(DIRTY_DELAY_MSEC);

    // Call `_writeStorge()` with the writer mutex held. **TODO:** If we want to
    // catch write errors (e.g. filesystem full), here is where we need to do
    // it.
    await this._writeMutex.withLockHeld(async () => {
      if (this._fileShouldExist) {
        await this._writeStorage();
      } else {
        await this._deleteStorage();
      }
    });

    return true;
  }

  /**
   * Helper for `_waitThenWriteStorage()`, which does all the actual filesystem
   * stuff when the file is supposed to be deleted.
   *
   * @returns {true} `true`, upon successful operation.
   */
  async _deleteStorage() {
    this._log.info('About to erase storage.');

    const exists = await afs.exists(this._storageDir);

    if (!exists) {
      this._log.info('Storage directory doesn\'t exist in the first place.');
      return true;
    }

    // This is a "deep delete" a la `rm -rf`.
    await afs.delete(this._storageDir);
    this._log.info('Erased storage directory.');

    // Reset the storage state instance variables. These should already be set
    // as such; this is just an innocuous extra bit of blatant safety.
    this._fileShouldExist = false;
    this._revNum          = -1;
    this._changes         = [];

    return true;
  }

  /**
   * Helper for `_waitThenWriteStorage()`, which does all the actual filesystem
   * stuff when there is stuff to write.
   *
   * @returns {true} `true`, upon successful writing.
   */
  async _writeStorage() {
    // Grab the instance variables that indicate what needs to be done, and then
    // reset them and the dirty flag. If additional writes are made while this
    // method is running, the dirty flag will end up getting flipped back on
    // and a separate call to `_waitThenWriteStorage()` will be made.

    const dirtyValues = this._storageToWrite;

    this._storageIsDirty = false;
    this._storageToWrite = new Map();

    this._log.info(`About to write ${dirtyValues.size} value(s).`);

    // Create the storage directory if needed.

    try {
      // If this call fails, then we assume the directory doesn't exist.
      await afs.access(this._storageDir, afs.constants.F_OK);
    } catch (e) {
      // The call failed.
      await afs.mkdir(this._storageDir);
      this._log.info('Created storage directory.');
    }

    // Perform the writes / deletes.

    let afsResults = [];
    for (const [revNum, data] of dirtyValues) {
      const fsPath = this._fsPathFromRevNum(revNum);

      afsResults.push(afs.writeFile(fsPath, data.toBuffer()));
      this._log.info('Wrote change:', revNum);

      if (afsResults.length >= MAX_PARALLEL_FS_CALLS) {
        await Promise.all(afsResults);
        this._log.detail(`Completed ${afsResults.length} FS write operations.`);
        afsResults = [];
      }
    }

    if (afsResults.length !== 0) {
      await Promise.all(afsResults);
      this._log.detail(`Completed ${afsResults.length} FS write operation(s).`);
    }

    this._log.info('Finished writing storage. Revision number:', this._changes.length - 1);
    return true;
  }

  /**
   * Converts a revision number to the full path of the file at which to find
   * the encoded change for that revision.
   *
   * @param {Int} revNum The revision number.
   * @returns {string} The absolute filesystem path to use for the change with
   *   the indicated `revNum`.
   */
  _fsPathFromRevNum(revNum) {
    RevisionNumber.check(revNum);

    // Convert to hex, left-pad with zeros, and add a filename suffix.
    const fileName = `${revNum.toString(16).padStart(8, '0')}.blob`;
    return path.resolve(this._storageDir, fileName);
  }

  /**
   * Converts a filesystem path for a stored change into the corresponding
   * revision number.
   *
   * @param {string} fsPath The filesystem path for a stored value. Can be
   *   relative or absolute.
   * @returns {Int} The corresponding revision number.
   */
  static _revNumFromFsPath(fsPath) {
    // Extract the hex string indicating the revision number.
    const match = fsPath.match(/(^|[/])([0-9a-f]{8})\.[^./]*$/);
    if (match === null) {
      throw Errors.wtf('Invalid storage path.');
    }

    const baseName = match[1];
    return parseInt(baseName, 16);
  }
}
