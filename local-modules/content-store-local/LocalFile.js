// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import afs from 'async-file';
import path from 'path';

import { Codec } from 'codec';
import { BaseFile } from 'content-store';
import { Logger } from 'see-all';
import { FrozenBuffer, PromCondition, PromDelay, PromMutex } from 'util-common';

import Transactor from './Transactor';

/** {Logger} Logger for this module. */
const log = new Logger('local-file');

/**
 * {Int} How long to wait (in msec) after a file becomes dirty and before it
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
     * {Map<string, FrozenBuffer>|null} Map from `StoragePath` strings to
     * corresponding stored data, for the entire file. `null` indicates that
     * the map is not yet initialized.
     */
    this._storage = null;

    /**
     * {Map<string, FrozenBuffer>|null} Map from `StoragePath` strings to
     * corresponding stored data, for file contents that have not yet been
     * written to disk.
     */
    this._storageToWrite = new Map();

    /**
     * {boolean} Whether or not there is any current need to write stored values
     * to disk. This is set to `true` when updates are made and back to `false`
     * once the writing has been done.
     */
    this._storageIsDirty = false;

    /**
     * {Promise<true>|null} Promise which resolves to `true` if `_storage` is
     * fully initialized with respect to the stored state. Becomes non-`null`
     * during the first call to `_readStorageIfNecessary()`. It is used to
     * prevent superfluous re-reading of the storage directory.
     */
    this._storageReadyPromise = null;

    /**
     * {PromMutex} Mutex that guards file writing operations, so that we only
     * ever have one set of writes in flight at any given time.
     */
    this._writeMutex = new PromMutex();

    /**
     * Condition that transitions from `false` to `true` when there is a
     * revision change and there are waiters for same. This remains `true` in
     * the steady state (when there are no waiters). As soon as the first waiter
     * comes along, it gets set to `false`.
     */
    this._changeCondition = new PromCondition(true);

    /**
     * {Codec} Codec to use specifically _just_ to encode and decode the file
     * revision number. (Coding for file content is handled by the superclass.)
     */
    this._revNumCodec = Codec.theOne;

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
    // This call will in fact create the file if it didn't already exist.
    await this._readStorageIfNecessary();

    // Indicate that the file needs to be written. If the file already exists,
    // this ends up being a no-op. **Note:** This call _synchronously_ (and
    // promptly) indicates that writing needs to happen, but the actual writing
    // takes place asynchronously.
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
   * @param {TransactionSpec} spec Same as with `transact()`.
   * @returns {object} Same as with `transact()`, except with `null`s instead of
   *   missing properties.
   */
  async _impl_transact(spec) {
    this._log.detail('Transaction:', spec);

    // Arrange for timeout. **Note:** Needs to be done _before_ reading
    // storage, as that storage read can take significant time.
    const timeoutMsec = this.clampTimeoutMsec(spec.timeoutMsec);
    let timeout = false; // Gets set to `true` when the timeout expires.
    const timeoutProm = PromDelay.resolve(timeoutMsec);
    (async () => {
      await timeoutProm;
      timeout = true;
    })();

    await Promise.race([this._readStorageIfNecessary(), timeoutProm]);
    if (timeout) {
      throw new Error('Transaction timed out.');
    }

    // Construct the "file friend" object. This exposes just enough private
    // state of this instance to the transactor (constructed immediately
    // hereafter) such that the latter can do its job.

    const revNum     = this._revNum;
    const storage    = this._storage;
    const fileFriend = {
      /** {Logger} Pass-through of this instance's logger. */
      log: this._log,

      /** {Int} Current revision number of the file. */
      revNum,

      /**
       * Gets the value stored at the given path, if any.
       *
       * @param {string} storagePath The path.
       * @returns {FrozenBuffer|null} The corresponding stored value, or `null`
       *   if there is none.
       */
      readPathOrNull(storagePath) {
        return storage.get(storagePath) || null;
      },

      /**
       * Gets an iterator over all path-based storage. Yielded elements are
       * entries of the form `[path, data]`.
       *
       * @returns {Iterator<string, FrozenBuffer>} Iterator over all path-based
       *   storage.
       */
      pathStorage() {
        return storage.entries();
      }
    };

    // Run the transaction, gather the results, and queue up the writes.

    const { data, updatedStorage } = new Transactor(spec, fileFriend).run();
    let newRevNum = null;

    if (updatedStorage.size !== 0) {
      this._revNum = newRevNum = revNum + 1;

      for (const [storagePath, value] of updatedStorage) {
        if (value === null) {
          this._log.detail(`Transaction deleted path: ${storagePath}`);
          this._storage.delete(storagePath);
        } else {
          this._log.detail(`Transaction wrote path: ${storagePath}`);
          this._storage.set(storagePath, value);
        }

        this._storageToWrite.set(storagePath, value);
      }

      this._storageNeedsWrite();
    }

    this._log.detail('Transaction complete.');
    return { revNum, newRevNum, data };
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {Int} timeoutMsec Same as with `whenChange()`.
   * @param {string} storagePath Same as with `whenChange()`.
   * @param {string|null} valueOrHash Same as with `whenChange()`, except that
   *   a buffer argument will have already been converted to a hash.
   * @returns {boolean} Same as with `whenChange()`.
   */
  async _impl_whenChange(timeoutMsec, storagePath, valueOrHash) {
    // Arrange for timeout. **Note:** Needs to be done _before_ reading
    // storage, as that storage read can take significant time.
    let timeout = false; // Gets set to `true` when the timeout expires.
    const timeoutProm = PromDelay.resolve(timeoutMsec);
    (async () => {
      await timeoutProm;
      timeout = true;
    })();

    await Promise.race([this._readStorageIfNecessary(), timeoutProm]);
    if (timeout) {
      this._log.detail('Timed out.');
      return false;
    }

    if (valueOrHash === null) {
      this._log.detail(`Want path to exist: ${storagePath}`);
    } else {
      this._log.detail(`Want change to path: ${storagePath}`);
    }

    // Check for the change condition, and iterate until either it's found or
    // the timeout expires.
    while (!timeout) {
      const storedValue = this._storage.get(storagePath);
      if (valueOrHash === null) {
        // If anything at all is stored at the path, the condition is satisfied.
        if (storedValue) {
          return true;
        }
      } else {
        // We are looking for a change from a specific value.
        if (storedValue && (storedValue.hash !== valueOrHash)) {
          // The stored value is indeed different than the given original.
          return true;
        } else if (!storedValue) {
          // There is no value stored at the path (that is, it was deleted or
          // perhaps was never bound), which counts as a change from any
          // existing value.
          return true;
        }
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
    return false;
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
      this._revNum  = 0;
      this._storage = new Map();
      this._log.info('New storage.');
      return true;
    }

    // The directory exists. Read its contents.
    this._log.info('Reading storage from disk...');

    const files   = await afs.readdir(this._storageDir);
    const storage = new Map();
    let   revNum;

    // This gets called to await on a chunk of FS ops at a time, storing them
    // into `storage`. It's called from the main loop immediately below.
    let paths    = [];
    let bufProms = [];
    const storeBufs = async () => {
      const bufs = await Promise.all(bufProms);
      this._log.detail('Completed FS ops.');
      for (let i = 0; i < paths.length; i++) {
        const storagePath = paths[i];
        storage.set(storagePath, FrozenBuffer.coerce(bufs[i]));
        this._log.info(`Read: ${storagePath}`);
      }

      paths    = [];
      bufProms = [];
    };

    // Loop over all the files, requesting their contents, and waiting for
    // a chunk of them at a time.
    for (const f of files) {
      paths.push(LocalFile._storagePathForFsName(f));
      bufProms.push(afs.readFile(path.resolve(this._storageDir, f)));
      if (paths.length >= MAX_PARALLEL_FS_CALLS) {
        await storeBufs();
      }
    }

    // Get the remaining partial chunks' worth of bufs, if any.
    if (paths.length !== 0) {
      await storeBufs();
    }

    this._log.info('Done reading storage.');

    // Parse the file revision number out of its special-named blob, and handle
    // things reasonably gracefully if it's missing or corrupt.
    try {
      const revNumBuffer = storage.get(REVISION_NUMBER_PATH);
      revNum = this._revNumCodec.decodeJsonBuffer(revNumBuffer);
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

    // Only set the instance variables after all the reading is done and the
    // current revision number is known.
    this._revNum         = revNum;
    this._storage        = storage;
    this._storageToWrite = new Map();
    this._storageIsDirty = false;

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
    await PromDelay.resolve(DIRTY_DELAY_MSEC);

    // Call `_writeStorge()` with the writer mutex held. The `try..finally` here
    // guarantees that we release the mutex in the face of errors.
    const unlock = await this._writeMutex.lock();
    try {
      // **TODO:** If we want to catch write errors (e.g. filesystem full), here
      // is where we need to do it.
      await this._writeStorage();
    } finally {
      unlock();
    }

    return true;
  }

  /**
   * Main guts of `_waitThenWriteStorage()`, which does all the actual
   * filesystem stuff.
   *
   * @returns {true} `true`, upon successful writing.
   */
  async _writeStorage() {
    // Grab the instance variables that indicate what needs to be done, and then
    // reset them and the dirty flag. If additional writes are made while this
    // method is running, the dirty flag will end up getting flipped back on
    // and a separate call to `_waitThenWriteStorage()` will be made.

    const dirtyValues = this._storageToWrite;
    const revNum      = this._revNum;

    this._storageIsDirty = false;
    this._storageToWrite = new Map();

    // Put the file revision number in the `dirtyValues` map. This way, it gets
    // written out without further special casing.
    dirtyValues.set(REVISION_NUMBER_PATH, this._revNumCodec.encodeJsonBuffer(revNum));

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
    for (const [storagePath, data] of dirtyValues) {
      const fsPath = this._fsPathForStorage(storagePath);
      if (data === null) {
        afsResults.push(afs.unlink(fsPath));
        this._log.info(`Deleted: ${storagePath}`);
      } else {
        afsResults.push(afs.writeFile(fsPath, data.toBuffer()));
        this._log.info(`Wrote: ${storagePath}`);
      }

      if (afsResults.length >= MAX_PARALLEL_FS_CALLS) {
        await Promise.all(afsResults);
        this._log.detail('Completed FS ops.');
        afsResults = [];
      }
    }

    if (afsResults.length !== 0) {
      await Promise.all(afsResults);
      this._log.detail('Completed FS ops.');
    }

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
