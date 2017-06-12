// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import afs from 'async-file';
import path from 'path';

import { BaseFile } from 'content-store';
import { Logger } from 'see-all';
import { PromDelay } from 'util-common';
import { FrozenBuffer } from 'util-server';


/** {Logger} Logger for this module. */
const log = new Logger('local-doc');

/**
 * {int} How long to wait (in msec) after a file becomes dirty and before it
 * gets written to disk. This keeps the system from thrashing the disk while
 * a file is being actively updated.
 */
const DIRTY_DELAY_MSEC = 5 * 1000; // 5 seconds.

/**
 * File implementation that stores everything in the locally-accessible
 * filesystem.
 */
export default class LocalFile extends BaseFile {
  /**
   * Constructs an instance.
   *
   * @param {string} fileId The ID of the file this instance represents.
   * @param {string} docPath The filesystem path for file storage.
   */
  constructor(fileId, docPath) {
    super(fileId);

    /**
     * {string} Path to the directory containing stored values for this file.
     */
    this._storageDir = docPath;

    /**
     * {Map<string,FrozenBuffer>|null} Map from `StoragePath` strings to
     * corresponding stored data, for the entire file. `null` indicates that
     * the map is not yet initialized.
     */
    this._storage = null;

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

    /** {Logger} Logger specific to this file's ID. */
    this._log = log.withPrefix(`[${fileId}]`);

    this._log.info('Constructed.');
    this._log.detail(`Path: ${this._docPath}`);
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
   */
  async _impl_create() {
    if (this._storageReadyPromise !== null) {
      // The storage could conceivably be in the middle of being read. Make sure
      // it's no longer in-process before proceeding. If it were in-process,
      // then when it was done it would mess up the instance variables being
      // set here.
      await this._storageReadyPromise;
    }

    this._storage             = new Map();
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
      this._storage = new Map();
      this._log.info('New storage.');
      return true;
    }

    // The directory exists. Read its contents.
    this._log.info('Reading storage from disk...');

    const files = await afs.readdir(this._storageDir);
    const storage = new Map();
    for (const f of files) {
      const buf = await afs.readFile(path.resolve(this._storageDir, f));
      const storagePath = LocalFile._storagePathForFsName(f);
      storage.set(storagePath, FrozenBuffer.coerce(buf));
      this._log.info(`Read: ${storagePath}`);
    }

    this._log.info('Done reading storage.');

    // Only set the instance variables after all the reading is done.
    this._storage             = storage;
    this._storageToWrite      = new Map();
    this._storageNeedsErasing = false;
    this._storageIsDirty      = false;

    return true;
  }

  /**
   * Indicates that there are elements of `_storage` that need to be written to
   * disk. This method acts (and returns) promptly. It will kick off a timed
   * callback to actually perform the writing operation(s) if one isn't already
   * pending.
   */
  _storageNeedsWrite() {
    if (this._storageIsDirty) {
      // Already marked dirty, which means there's nothing more to do. When
      // the already-scheduled timer fires, it will pick up the current change.
      this._log.detail('Storage already marked dirty.');
      return;
    }

    // Mark the storage dirty, and queue up the writer.

    this._storageIsDirty = true;

    if (this._storageNeedsErasing) {
      this._log.info(`Storage will be erased.`);
    }
    this._log.info(`Value(s) to write: ${this._storageToWrite.size}`);

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

    this._storageIsDirty      = false;
    this._storageNeedsErasing = false;
    this._storageToWrite      = new Map();

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

    this._log.info('Finished writing storage.');
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
