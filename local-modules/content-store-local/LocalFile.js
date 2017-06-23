// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import afs from 'async-file';
import path from 'path';

import { BaseFile } from 'content-store';
import { Logger } from 'see-all';
import { PromCondition, PromDelay } from 'util-common';
import { FrozenBuffer } from 'util-server';

import Transactor from './Transactor';

/** {Logger} Logger for this module. */
const log = new Logger('local-file');

/**
 * {int} How long to wait (in msec) after a file becomes dirty and before it
 * gets written to disk. This keeps the system from thrashing the disk while
 * a file is being actively updated.
 */
const DIRTY_DELAY_MSEC = 5 * 1000; // 5 seconds.

/**
 * {string} Special storage path to use to record the file revision number. The
 * `@` prefix on the path guarantees that it won't conflict with higher-layer
 * uses, as that isn't a valid `StoragePath` character.
 *
 * **Note:** Higher layers of the system (that use this module) can (and do)
 * define their own separate concept of revision numbering. These are
 * intentionally not the same thing.
 */
const REVISION_NUMBER_PATH = '/@local_file_revision_number';

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
   */
  constructor(fileId, filePath) {
    super(fileId);

    /**
     * {string} Path to the directory containing stored values for this file.
     */
    this._storageDir = filePath;

    /**
     * {Int|null} Current file revision number or `null` if not yet initialized.
     */
    this._revNum = null;

    /**
     * {Map<string,FrozenBuffer>|null} Map from `StoragePath` strings to
     * corresponding stored data, for the entire file. `null` indicates that
     * the map is not yet initialized.
     */
    this._storage = null;

    /**
     * {Map<string,Int>|null} Map from `StoragePath` strings to the most recent
     * revision number that affected the corresponding path. This includes
     * entries for paths that have been deleted. `null` indicates that the map
     * is not yet initialized.
     */
    this._storageRevNums = null;

    /**
     * {Map<string,FrozenBuffer>|null} Map from `StoragePath` strings to
     * corresponding stored data, for file contents that have not yet been
     * written to disk.
     */
    this._storageToWrite = new Map();

    /**
     * {boolean} Whether or not the storage directory should be totally erased
     * and recreated before proceeding with any writing of dirty values.
     */
    this._storageNeedsErasing = false;

    /**
     * {boolean} Whether or not there is any current need to write stored values
     * to disk. This is set to `true` when updates are made and back to `false`
     * once the writing has been done.
     */
    this._storageIsDirty = false;

    /**
     * {Promise<true>|null} Promise which resolves to `true` if `_storage` is
     * fully initialized with respect to the stored state. Becomes non-`null`
     * during the first call to `_readStorageIfNecessary()` and in
     * `_impl_create()`. It is used to prevent superfluous re-reading of the
     * storage directory.
     */
    this._storageReadyPromise = null;

    /**
     * Condition that transitions from `false` to `true` when there is a
     * revision change and there are waiters for same. This remains `true` in
     * the steady state (when there are no waiters). As soon as the first waiter
     * comes along, it gets set to `false`.
     */
    this._changeCondition = new PromCondition(true);

    /** {Logger} Logger specific to this file's ID. */
    this._log = log.withPrefix(`[${fileId}]`);

    this._log.info(`Path: ${this._storageDir}`);
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
    if (this._storageReadyPromise !== null) {
      // The storage could conceivably be in the middle of being read. Make sure
      // it's no longer in-process before proceeding. If it were in-process,
      // then when it was done it would mess up the instance variables being
      // set here.
      await this._storageReadyPromise;
    }

    this._revNum              = 0;
    this._storage             = new Map();
    this._storageRevNums      = new Map();
    this._storageToWrite      = new Map();
    this._storageNeedsErasing = true;
    this._storageReadyPromise = Promise.resolve(true);

    // **Note:** This call _synchronously_ (and promptly) indicates that writing
    // needs to happen, but the actual writing takes place asynchronously.
    this._storageNeedsWrite();
  }

  /**
   * Implementation as required by the superclass.
   *
   * @returns {boolean} `true` iff this file exists.
   */
  async _impl_exists() {
    if (this._storage !== null) {
      // Whether or not the file exists, the file is considered to exist because
      // it has a non-empty in-memory model. (For example, it might have been
      // `create()`d but not yet stored to disk.)
      return true;
    } else {
      // If the file exists, then the file exists. It might turn out to be the
      // case that the file contents are invalid; however, by definition that is
      // taken to be an _existing_ but _empty_ file.
      return afs.exists(this._storageDir);
    }
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {string} storagePath Path to write to.
   * @param {FrozenBuffer|null} newValue Value to write, or `null` if the value
   *   at `path` is to be deleted.
   * @returns {boolean} `true` once the write operation is complete.
   */
  async _impl_forceOp(storagePath, newValue) {
    await this._readStorageIfNecessary();

    this._storeOrDeleteValue(storagePath, newValue);
    return true;
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {string} storagePath Path to write to.
   * @param {FrozenBuffer|null} oldValue Value expected to be stored at `path`
   *   at the moment of writing, or `null` if `path` is expected to have nothing
   *   stored at it.
   * @param {FrozenBuffer|null} newValue Value to write, or `null` if the value
   *   at `path` is to be deleted.
   * @returns {boolean} `true` if the write is successful, or `false` if it
   *   failed due to value mismatch.
   */
  async _impl_op(storagePath, oldValue, newValue) {
    await this._readStorageIfNecessary();

    const existingValue = this._storage.get(storagePath) || null;

    if (oldValue !== existingValue) {
      if (   (oldValue === null)
          || (existingValue === null)
          || !oldValue.equals(existingValue)) {
        // Mismatch between expected and actual pre-existing value.
        return false;
      }
    }

    this._storeOrDeleteValue(storagePath, newValue);
    return true;
  }

  /**
   * Implementation as required by the superclass.
   *
   * @returns {Int} The instantaneously current revision number of the file.
   */
  async _impl_revNum() {
    await this._readStorageIfNecessary();
    return this._revNum;
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {TransactionSpec} spec Same as with `transact()`.
   * @returns {object} Same as with `transact()`, except with `null`s instead of
   *   missing properties.
   */
  async _impl_transact(spec) {
    await this._readStorageIfNecessary();

    this._log.info('Transaction:', spec);

    // Construct the "file friend" object. This exposes just enough private
    // state of this instance to the transactor (constructed immediately
    // hereafter) such that the latter can do its job.
    const fileFriend = {
      /** {Logger} Pass-through of this instance's logger. */
      log: this._log,

      /** {Int} Current revision number of the file. */
      revNum: this._revNum
    };

    const transactor = new Transactor(spec, fileFriend);

    return transactor.run();
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {Int} timeoutMsec Same as with `whenChange()`.
   * @param {Int} baseRevNum Same as with `whenChange()`.
   * @param {string|null} storagePath Same as with `whenChange()`.
   * @returns {Int|null} Same as with `whenChange()`.
   */
  async _impl_whenChange(timeoutMsec, baseRevNum, storagePath) {
    // Arrange for timeout. **Note:** Needs to be done _before_ reading
    // storage, as that storage read can take significant time.
    let timeout = false; // Gets set to `true` when the timeout expires.
    const timeoutProm = PromDelay.resolve(timeoutMsec);
    (async () => {
      await timeoutProm;
      timeout = true;
    })();

    await this._readStorageIfNecessary();

    if (baseRevNum > this._revNum) {
      // Per the superclass docs (and due to the asynch nature of the system),
      // we don't know that `baseRevNum` was passed in as an in-range value.
      throw new Error(`Nonexistent \`revNum\`: ${baseRevNum}`);
    }

    if (storagePath === null) {
      this._log.detail(`Want change after \`revNum\` ${baseRevNum}.`);
    } else {
      this._log.detail(`Want change after \`revNum\` ${baseRevNum}: ${storagePath}`);
    }

    // Check for the change condition, and iterate until either it's found or
    // the timeout expires.
    while (!timeout) {
      // If `storagePath` is `null`, we are looking for any revision after the
      // file's overall current revision number. If `path` is non-`null`, we are
      // looking for a revision since the last one for that specific path.
      let foundRevNum;
      if (storagePath === null) {
        // `storagePath` is `null`. We are looking for any revision after the
        // file's overall current revision number.
        foundRevNum = this._revNum;
      } else {
        // `storagePath` is non-`null`. We are looking for a revision
        // specifically on that path.
        foundRevNum = this._storageRevNums.get(storagePath);
        if (foundRevNum === undefined) {
          // A non-existent and never-existed path is effectively unmodified, for
          // the subsequent logic.
          foundRevNum = baseRevNum;
        }
      }

      if (foundRevNum > baseRevNum) {
        // Found!
        this._log.detail(`Noticed change at \`revNum\` ${foundRevNum}.`);
        return foundRevNum;
      }

      this._log.detail('Waiting for file to change.');

      // Force the `_changeCondition` to `false` (though it might already be
      // so set; innocuous if so), and wait either for it to become `true` (that
      // is, wait for _any_ change to the file) or for the timeout to pass.
      this._changeCondition.value = false;
      await Promise.race([this._changeCondition.whenTrue(), timeoutProm]);
    }

    // The timeout expired.
    this._log.detail('Timed out.');
    return null;
  }

  /**
   * Helper for the update methods, which performs the actual updating.
   *
   * @param {string} storagePath Path to write to.
   * @param {FrozenBuffer|null} newValue Value to write, or `null` if the value
   *   at `path` is to be deleted.
   */
  _storeOrDeleteValue(storagePath, newValue) {
    if (newValue === null) {
      this._storage.delete(storagePath);
    } else {
      this._storage.set(storagePath, newValue);
    }

    this._revNum++;
    this._storageRevNums.set(storagePath, this._revNum);
    this._storageToWrite.set(storagePath, newValue);
    this._storageNeedsWrite();
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {string} storagePath Path to read from.
   * @returns {FrozenBuffer|null} Value stored at the indicated path, or `null`
   *   if there is none.
   */
  async _impl_pathReadOrNull(storagePath) {
    await this._readStorageIfNecessary();
    return this._storage.get(storagePath) || null;
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
   * Reads the storage directory, initializing `_storage`. If the directory
   * doesn't exist, this will initialize the in-memory model with empty contents
   * but does _not_ mark the storage as dirty.
   *
   * @returns {Promise<true>} Promise that resolves once the storage has been
   *   successfully read into memory.
   */
  async _readStorage() {
    if (!await afs.exists(this._storageDir)) {
      // Directory doesn't actually exist. Just initialize empty storage.
      this._revNum         = 0;
      this._storage        = new Map();
      this._storageRevNums = new Map();
      this._log.info('New storage.');
      return true;
    }

    // The directory exists. Read its contents.
    this._log.info('Reading storage from disk...');

    const files          = await afs.readdir(this._storageDir);
    const storage        = new Map();
    const storageRevNums = new Map();
    let   revNum;

    for (const f of files) {
      const buf = await afs.readFile(path.resolve(this._storageDir, f));
      const storagePath = LocalFile._storagePathForFsName(f);
      storage.set(storagePath, FrozenBuffer.coerce(buf));
      this._log.info(`Read: ${storagePath}`);
    }

    this._log.info('Done reading storage.');

    // Parse the file revision number out of its special-named blob, and handle
    // things reasonably gracefully if it's missing or corrupt.
    try {
      const revNumBuffer = storage.get(REVISION_NUMBER_PATH);
      revNum = JSON.parse(revNumBuffer.string);
      this._log.info(`Starting revision number: ${revNum}`);
    } catch (e) {
      // In case of failure, use the size of the storage map as a good enough
      // value for `revNum`. This case probably won't happen in practice except
      // when dealing with corrupt FS contents, but even if it does, this should
      // be fine in that the primary required guarantee is monotonic increase
      // within any given process (and not really across processes).
      revNum = storage.size;
      this._log.info(`Starting with "fake" revision number: ${revNum}`);
    }

    // Note the revision number of all paths. Since we don't record this info
    // to the FS, the best we can do is peg them all at the current revision
    // number.
    for (const k of storage.keys()) {
      storageRevNums.set(k, revNum);
    }

    // Only set the instance variables after all the reading is done and the
    // current revision number is known.
    this._revNum              = revNum;
    this._storage             = storage;
    this._storageRevNums      = storageRevNums;
    this._storageToWrite      = new Map();
    this._storageNeedsErasing = false;
    this._storageIsDirty      = false;

    return true;
  }

  /**
   * Indicates that there are elements of `_storage` that need to be written to
   * disk. This method acts (and returns) promptly. It will kick off a timed
   * callback to actually perform the writing operation(s) if one isn't already
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

    if (this._storageNeedsErasing) {
      this._log.info('Storage will be erased.');
    }

    this._log.info('About to write. ' +
      `${this._storageToWrite.size} value(s); revision number: ${this._revNum}`);

    // **TODO:** If we want to catch write errors (e.g. filesystem full), here
    // is where we need to do it.
    this._waitThenWriteStorage();
  }

  /**
   * Waits for a moment, and then writes the then-current dirty storage.
   * The return value becomes resolved once writing is complete.
   *
   * **Note:** As of this writing, the return value isn't used, but ultimately
   * we will probably want to notice if it throws an exception instead of
   * letting problems just vaporize via unhandled promises.
   *
   * @returns {true} `true`, upon successful writing.
   */
  async _waitThenWriteStorage() {
    // Wait for the prescribed amount of time.
    await PromDelay.resolve(DIRTY_DELAY_MSEC);

    // Grab the instance variables that indicate what needs to be done, and then
    // reset them and the dirty flag. At the end of this method, we check to see
    // if the dirty flag got flipped back on, and if so iterate.

    const storageNeedsErasing = this._storageNeedsErasing;
    const dirtyValues         = this._storageToWrite;
    const revNum              = this._revNum;

    this._storageIsDirty      = false;
    this._storageNeedsErasing = false;
    this._storageToWrite      = new Map();

    // Put the file revision number in the `dirtyValues` map. This way, it gets
    // written out without further special casing.
    dirtyValues.set(REVISION_NUMBER_PATH,
      FrozenBuffer.coerce(JSON.stringify(revNum)));

    // Erase and/or create the storage directory as needed.

    let needDirCreate = false;

    try {
      await afs.access(this._storageDir, afs.constants.F_OK);
    } catch (e) {
      needDirCreate = true;
    }

    if (storageNeedsErasing && !needDirCreate) {
      try {
        // This is a "deep delete" a la `rm -rf`.
        await afs.delete(this._storageDir);
        this._log.info('Erased storage.');
      } catch (e) {
        // Ignore it: This is most likely because the directory didn't exist in
        // the first place. But if not, the directory creation immediately
        // below will fail with an error that _isn't_ caught here.
      }

      needDirCreate = true;
    }

    if (needDirCreate) {
      await afs.mkdir(this._storageDir);
      this._log.info('Created storage directory.');
    }

    // Perform the writes.

    for (const [storagePath, data] of dirtyValues) {
      const fsPath = this._fsPathForStorage(storagePath);
      if (data === null) {
        await afs.unlink(fsPath);
        this._log.info(`Deleted: ${storagePath}`);
      } else {
        await afs.writeFile(fsPath, data.toBuffer());
        this._log.info(`Wrote: ${storagePath}`);
      }
    }

    // Check to see if more updates happened while the writing was being done.
    // If so, recurse to iterate.

    if (this._storageIsDirty) {
      this._log.info('Storage modified during write operation.');
      return this._waitThenWriteStorage();
    }

    // The usual case: Everything is fine.

    this._log.info(`Finished writing storage. Revision number: ${revNum}`);
    return true;
  }

  /**
   * Converts a `StoragePath` string to the name of the file at which to find
   * the data for that path. In particular, we don't want the hiererarchical
   * structure of the path to turn into nested directories, so slashes (`/`) get
   * converted to tildes (`~`), the latter which is not a valid character for
   * a storage path component. This also appends the filetype suffix `.blob`.
   *
   * @param {string} storagePath The storage path.
   * @returns {string} The fully-qualified file name to use when accessing
   *   `path`.
   */
  _fsPathForStorage(storagePath) {
    // `slice(1)` trims off the initial slash.
    const fileName = `${storagePath.slice(1).replace(/\//g, '~')}.blob`;
    return path.resolve(this._storageDir, fileName);
  }

  /**
   * Converts a filesystem file name for a stored value into a `StoragePath`
   * string identifying same. This is approximately the inverse of
   * `_fsPathForStorage()` (only approximate because this one expects a simple
   * name, not a fully-qualified filesystem path).
   *
   * @param {string} fsName The file name for a stored value.
   * @returns {string} The `StoragePath` string corresponding to `fsName`.
   */
  static _storagePathForFsName(fsName) {
    return `/${fsName.replace(/~/g, '/').replace(/\..*$/, '')}`;
  }
}
