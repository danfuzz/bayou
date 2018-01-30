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
import { TString } from 'typecheck';
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
   * @param {string} storagePath The filesystem path for file storage.
   * @param {Codec} codec Codec instance to use when encoding and decoding
   *   changes.
   */
  constructor(fileId, storagePath, codec) {
    super(fileId);

    /**
     * {Codec} Codec instance to use when encoding and decoding items for
     * storage.
     */
    this._codec = Codec.check(codec);

    /**
     * {string} Path to the directory containing stored values for this file.
     */
    this._storagePath = TString.nonEmpty(storagePath);

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

    this._log.info('Path:', this._storagePath);
  }

  /**
   * {string} The filesystem path where the storage for this instance resides.
   */
  get storagePath() {
    return this._storagePath;
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
   * Forces pending writes to happen promptly, and waits until they have been
   * completed and settled in the filesystem.
   *
   * **Note:** This method wouldn't be necessary if {@link #_impl_create},
   * {@link #_impl_transact}, etc. were all more realistically transactional.
   */
  async flush() {
    await this._flushPendingStorage();
  }

  /**
   * Implementation as required by the superclass.
   */
  async _impl_create() {
    await this._readStorageIfNecessary();

    if (!this._fileShouldExist) {
      // Indicate that the file should exist.
      this._fileShouldExist = true;

      // Make the standard empty initial change.
      const firstChange = new FileChange(0, []);
      this._changes[0] = firstChange;
      this._storageToWrite.set(0, this._encodeChange(firstChange));

      // Get it written out.
      this._storageNeedsFlush();
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
      this._changes         = [];
      this._snapshot        = null;

      // Get it erased.
      this._storageNeedsFlush();
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

      this._changes[change.revNum] = change;
      this._storageToWrite.set(change.revNum, this._encodeChange(change));
      this._storageNeedsFlush();

      // Form the return value as required by the `_impl_transact()` contract.
      return {
        data:      null,
        newRevNum: change.revNum,
        paths:     null,
        revNum:    snapshot.revNum
      };
    } else if (spec.hasWaitOps()) {
      // It's a wait transaction, so we need to be prepared to loop / retry
      // (until satisfaction or timeout).
      for (;;) {
        const snapshot   = this._currentSnapshot;
        const pathResult = spec.runWait(snapshot);

        if (pathResult !== null) {
          // Form the return value as required by the `_impl_transact()`
          // contract.
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
    } else {
      // It's a prerequisite-only transaction. Do the requested checks, and
      // return a nearly-empty return value as required by the
      // `_impl_transact()` contract.
      const snapshot = this._currentSnapshot;

      spec.runPrerequisites(snapshot);
      return {
        data:      null,
        newRevNum: null,
        paths:     null,
        revNum:    snapshot.revNum
      };
    }
  }

  /**
   * {RevisionNumber|-1} Current revision number, or `-1` if the file either
   * doesn't exist at all or is in the transitional state where it exists but
   * there aren't yet any changes written.
   */
  get _currentRevNum() {
    return this._changes.length - 1;
  }

  /**
   * {FileSnapshot} Snapshot of the current revision. It is not valid to get
   * this if the file doesn't exist (created and has at least one change).
   */
  get _currentSnapshot() {
    const revNum  = this._currentRevNum;
    const changes = this._changes;
    const already = this._snapshot;

    if (revNum < 0) {
      throw Errors.badUse('File does not exist and/or has no changes at all!');
    }

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
   * Decodes the given change from the given buffer.
   *
   * @param {FrozenBuffer} buf Buffer from which to decode a change instance.
   * @returns {FileChange} Decoded change instance.
   */
  _decodeChange(buf) {
    FrozenBuffer.check(buf);

    const result = this._codec.decodeJsonBuffer(buf);

    return FileChange.check(result);
  }

  /**
   * Helper for {@link #_waitThenFlushStorage()}, which does all the actual
   * filesystem stuff when the file is supposed to be deleted.
   *
   * @returns {true} `true`, upon successful operation.
   */
  async _deleteStorage() {
    this._log.info('About to erase storage.');

    const exists = await afs.exists(this._storagePath);

    if (!exists) {
      this._log.info('Storage directory doesn\'t exist in the first place.');
      return true;
    }

    // This is a "deep delete" a la `rm -rf`.
    await afs.delete(this._storagePath);
    this._log.info('Erased storage directory.');

    // Reset the storage state instance variables. These should already be set
    // as such; this is just an innocuous extra bit of blatant safety.
    this._fileShouldExist = false;
    this._changes         = [];

    return true;
  }

  /**
   * Encodes the given change, for writing to storage.
   *
   * @param {FileChange} change Change to encode.
   * @returns {FrozenBuffer} Encoded form.
   */
  _encodeChange(change) {
    FileChange.check(change);

    return this._codec.encodeJsonBuffer(change);
  }

  /**
   * Flushes all pending storage activity to the filesystem (writing and/or
   * deleting files). The return value becomes resolved once the action is
   * complete.
   *
   * @returns {true} `true`, upon successful flushing.
   */
  async _flushPendingStorage() {
    // Call the appropriate helper method with the writer mutex held.
    // **TODO:** If we want to catch write errors (e.g. filesystem full), here
    // is where we need to do it.
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
    return path.resolve(this._storagePath, fileName);
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
    if (!await afs.exists(this._storagePath)) {
      // Directory doesn't actually exist. Just initialize empty storage.
      this._fileShouldExist = false;
      this._changes         = [];
      this._snapshot        = null;

      this._changeCondition.value = true;

      this._log.info('New storage.');
      return true;
    }

    // The directory exists. Read its contents.
    this._log.info('Reading storage from disk...');

    const files       = await afs.readdir(this._storagePath);
    const changes     = [];
    let   changeCount = 0;

    // This gets called to await on a chunk of FS reads at a time, storing them
    // into `changes`. It's called from the main loop immediately below.
    const storeBufs = async (bufProms) => {
      this._log.detail(`Completed ${bufProms.size} FS read operations(s).`);
      for (const [n, bufProm] of bufProms) {
        const buf    = await bufProm;
        const fbuf   = new FrozenBuffer(buf);
        const change = FileChange.check(this._decodeChange(fbuf));

        if (n !== change.revNum) {
          throw Errors.badData(`Name / data mismatch for alleged revision number ${n}; found ${change.revNum}.`);
        }

        changes[n] = change;
        this._log.info('Read change:', change.revNum);
      }
    };

    // Loop over all the files, requesting their contents, and waiting for
    // a chunk of them at a time.
    let bufPromMap = new Map();
    for (const f of files) {
      const n = LocalFile._revNumFromFsPath(f);

      if (n !== null) {
        const bufProm = afs.readFile(path.resolve(this._storagePath, f));

        bufPromMap.set(n, bufProm);
        changeCount++;

        if (bufPromMap.size >= MAX_PARALLEL_FS_CALLS) {
          await storeBufs(bufPromMap);
          bufPromMap = new Map();
        }
      }
    }

    // Get the remaining partial chunks' worth of bufs, if any.
    if (bufPromMap.size !== 0) {
      await storeBufs(bufPromMap);
    }

    this._log.info('Done reading storage.');

    // Validate that there are no holes, and set up `revNum`.

    if (changeCount !== changes.length) {
      // Hole!
      throw Errors.badData('Missing at least one change.');
    }

    // Only set the instance variables after all the reading is done and the
    // current revision number is known.

    if (changeCount > 0) {
      // The usual case, handled here, is that there is at least one change.
      this._fileShouldExist = true;
      this._log.info('Starting revision number:', changeCount - 1);
    } else {
      // The file's directory exists, but there weren't any change blobs. This
      // can happen if the code gets run on an incompatibly (older or newer)
      // `LocalFile` implementation. We treat this case the same as the file
      // not existing.
      this._fileShouldExist = false;
      this._log.info(
        'FYI, it looks like this file is in an incompatible format.\n' +
        'Treating it as if it doesn\'t exist.');
    }

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
   * Indicates that there is file state that needs to be written to disk. This
   * method acts (and returns) promptly. It will kick off a timed callback to
   * actually perform any needed writing operation(s) if one isn't already
   * pending. In addition, it flips `_changeCondition` to `true` (if not
   * already set as such), which unblocks code that was awaiting any changes.
   */
  _storageNeedsFlush() {
    // Release anything awaiting a change.
    this._changeCondition.value = true;

    if (this._storageIsDirty) {
      // Already marked dirty, which means there's nothing more to do. When
      // the already-scheduled timer fires, it will pick up the current change.
      this._log.detail('Storage already marked dirty.');
      return;
    }

    // Mark the storage dirty, and then queue up the writer after the prescribed
    // amount of time.

    this._log.info('Storage modified. Waiting a moment for further changes.');
    this._storageIsDirty = true;

    // This is done in a separate `async` block, because the method's contract
    // is for the rest of the actions (above) to be done promptly, action which
    // wouldn't happen as such if the whole method were marked `async`.
    (async () => {
      await Delay.resolve(DIRTY_DELAY_MSEC);
      await this._flushPendingStorage();
    })();
  }

  /**
   * Helper for {@link #_waitThenFlushStorage()}, which does all the actual
   * filesystem stuff when there is stuff to write.
   *
   * @returns {true} `true`, upon successful writing.
   */
  async _writeStorage() {
    // Grab the instance variables that indicate what needs to be done, and then
    // reset them and the dirty flag. If additional writes are made while this
    // method is running, the dirty flag will end up getting flipped back on
    // and a separate call to `_waitThenFlushStorage()` will be made.

    const dirtyValues = this._storageToWrite;

    this._storageIsDirty = false;
    this._storageToWrite = new Map();

    this._log.info(`About to write ${dirtyValues.size} value(s).`);

    // Create the storage directory if needed.

    try {
      // If this call fails, then we assume the directory doesn't exist.
      await afs.access(this._storagePath, afs.constants.F_OK);
    } catch (e) {
      // The call failed.
      await afs.mkdir(this._storagePath);
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
   * Converts a filesystem path for a stored change into the corresponding
   * revision number.
   *
   * @param {string} fsPath The filesystem path for a stored change. Can be
   *   relative or absolute.
   * @returns {Int|null} The corresponding revision number, or `null` if the
   *   path doesn't correspond to a stored file change. `null` can occur if
   *   there are leftover file contents from a different (earlier or perhaps
   *   later) `LocalFile` implementation.
   */
  static _revNumFromFsPath(fsPath) {
    // Extract the hex string indicating the revision number.
    const match = fsPath.match(/(?:^|[/])([0-9a-f]{8})\.[^./]*$/);
    if (match === null) {
      return null;
    }

    const baseName = match[1];
    const result   = parseInt(baseName, 16);

    return RevisionNumber.check(result);
  }
}
