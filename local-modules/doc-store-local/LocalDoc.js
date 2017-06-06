// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import afs from 'async-file';
import path from 'path';

import { Decoder, Encoder } from 'api-common';
import { VersionNumber } from 'doc-common';
import { BaseDoc } from 'doc-store';
import { Logger } from 'see-all';
import { TObject } from 'typecheck';
import { PromDelay } from 'util-common';


/** {Logger} Logger for this module. */
const log = new Logger('local-doc');

/**
 * {int} How long to wait (in msec) after a document becomes dirty and before it
 * gets written to disk. This keeps the system from thrashing the disk while
 * a document is being actively updated.
 */
const DIRTY_DELAY_MSEC = 5 * 1000; // 5 seconds.

/**
 * Document implementation that stores everything in the
 * locally-accessible filesystem.
 */
export default class LocalDoc extends BaseDoc {
  /**
   * Constructs an instance.
   *
   * @param {string} formatVersion The format version to expect and use.
   * @param {string} docId The ID of the document this instance represents.
   * @param {string} docPath The filesystem path for document storage.
   */
  constructor(formatVersion, docId, docPath) {
    super(docId);

    /** {string} The format version to expect and use. */
    this._formatVersion = formatVersion;

    /** {string} Path to the change storage for this document. */
    this._path = `${docPath}.json`;

    /**
     * {string} Path to the directory containing stored values for this
     * document.
     */
    this._storageDir = docPath;

    /**
     * {Map<string,FrozenBuffer>|null} Map from `StoragePath` strings to
     * corresponding stored data, for the entire document. `null` indicates that
     * the map is not yet initialized.
     */
    this._storage = null;

    /**
     * {Map<string,FrozenBuffer>|null} Map from `StoragePath` strings to
     * corresponding stored data, for document contents that have not yet been
     * written to disk.
     */
    this._dirtyValues = new Map();

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
     * {array<DocumentChange>|null} Array of changes. Index `n` contains the
     * change that produces version number `n`. `null` indicates that the array
     * is not yet initialized.
     */
    this._changes = null;

    /**
     * {Promise<array<DocumentChange>>|null} Promise for the value of
     * `_changes`. Becomes non-`null` during the first call to
     * `_readChangesIfNecessary()` and is used to prevent superfluous re-reading.
     */
    this._changesPromise = null;

    /**
     * Does the change array need to be written to disk? This is set to `true`
     * on updates and back to `false` once the write has been done.
     */
    this._changesDirty = false;

    /**
     * Does the document need to be "migrated?" In this case, `true` indicates
     * that the document file exists but could not actually be read and parsed
     * successfully. This variable is set in `_readChanges()`.
     */
    this._needsMigration = null;

    /** {Logger} Logger specific to this document's ID. */
    this._log = log.withPrefix(`[${docId}]`);

    this._log.info('Constructed.');
    this._log.detail(`Path: ${this._path}`);
  }

  /**
   * Implementation as required by the superclass.
   *
   * @returns {boolean} `true` iff this document exists.
   */
  async _impl_exists() {
    if (this._changes !== null) {
      // Whether or not the file exists, the document is considered to exist
      // because it has a non-empty in-memory model. (For example, it might have
      // been `create()`d but not yet stored to disk.)
      return true;
    } else {
      // If the file exists, then the document exists. It might turn out to be
      // the case that the file contents are invalid; however, by definition
      // that is taken to be an _existing_ but _empty_ file.
      return afs.exists(this._path);
    }
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {DocumentChange} firstChange The first change to include in the
   *   document.
   */
  async _impl_create(firstChange) {
    this._changes = [firstChange];

    if (this._storageReadyPromise !== null) {
      // The storage could conceivably be in the middle of being read. Make sure
      // it's no longer in-process before proceeding. If it were in-process,
      // then when it was done it would mess up the instance variables being
      // set here.
      await this._storageReadyPromise;
    }

    this._storage             = new Map();
    this._dirtyValues         = new Map();
    this._storageNeedsErasing = true;
    this._storageReadyPromise = Promise.resolve(true);

    // **Note:** This call _synchronously_ (and promptly) indicates that writing
    // needs to happen, but the actual writing takes place asynchronously.
    this._changesNeedWrite();
    this._storageNeedsWrite();
  }

  /**
   * Implementation as required by the superclass.
   *
   * @returns {Int|null} The version number of this document.
   */
  async _impl_currentVerNum() {
    await this._readChangesIfNecessary();
    const len = this._changes.length;
    return (len === 0) ? null : (len - 1);
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {Int} verNum The version number for the desired change.
   * @returns {DocumentChange} The change with `verNum` as indicated.
   */
  async _impl_changeRead(verNum) {
    await this._readChangesIfNecessary();

    VersionNumber.maxExc(verNum, this._changes.length);
    return this._changes[verNum];
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {DocumentChange} change The change to append.
   * @returns {boolean} `true` if the append was successful, or `false` if it
   *   was not due to `change` having an incorrect `verNum`.
   */
  async _impl_changeAppend(change) {
    await this._readChangesIfNecessary();

    if (change.verNum !== this._changes.length) {
      // Not the right `verNum`. This is typically because there was an append
      // race, and this is the losing side.
      return false;
    }

    this._changes[change.verNum] = change;

    // **Note:** This call _synchronously_ (and promptly) indicates that writing
    // needs to happen, but the actual writing takes place asynchronously.
    this._changesNeedWrite();

    return true;
  }

  /**
   * Implementation as required by the superclass.
   *
   * @returns {boolean} `true` iff the document needs migration.
   */
  async _impl_needsMigration() {
    await this._readChangesIfNecessary();
    return this._needsMigration;
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {string} storagePath Path to write to.
   * @param {FrozenBuffer|null} oldValue Value expected to be stored at `path`
   *   at the moment of writing, or `null` if `path` is expected to have nothing
   *   stored at it.
   * @param {FrozenBuffer} newValue Value to write.
   * @returns {boolean} `true` if the write is successful, or `false` if it
   *   failed due to value mismatch.
   */
  async _impl_op(storagePath, oldValue, newValue) {
    // TODO: Implement this!

    // This keeps the linter happy.
    if ((storagePath + oldValue + newValue) === null) {
      return false;
    }

    throw new Error('TODO');
  }

  /**
   * Indicates that the document is "dirty" and needs to be written. This
   * method acts (and returns) promptly. It will kick off a timed callback
   * to actually perform the writing operation if one isn't already pending.
   */
  _changesNeedWrite() {
    if (this._changesDirty) {
      // Already marked dirty, which means there's nothing more to do. When
      // the already-scheduled timer fires, it will pick up the current change.
      this._log.detail('Already marked dirty.');
      return;
    }

    // Mark the document dirty, and queue up the writer.

    this._changesDirty = true;
    this._log.detail(`Marked dirty at version ${this._changes.length}.`);

    // **TODO:** If we want to catch write errors (e.g. filesystem full), here
    // is where we need to do it.
    this._waitThenWriteChanges();
  }

  /**
   * Waits for a moment, and then writes the then-current version of the
   * document. The return value becomes resolved once writing is complete.
   *
   * **Note:** As of this writing, the return value isn't used, but ultimately
   * we will probably want to notice if it throws an exception instead of
   * letting problems just vaporize via unhandled promises.
   *
   * @returns {true} `true`, upon successful writing.
   */
  async _waitThenWriteChanges() {
    // Wait for the prescribed amount of time.
    await PromDelay.resolve(DIRTY_DELAY_MSEC);

    // Perform the file write.

    const changes     = this._changes;
    const version     = this._formatVersion;
    const encoded     = Encoder.encodeJson({ version, changes }, true);

    // These are for dirty/clean verification. See big comment below.
    const changeCount = changes.length;
    const firstChange = changes[0];

    this._log.detail('Writing to disk...');
    await afs.writeFile(this._path, encoded, { encoding: 'utf8' });
    this._log.info(`Wrote version ${changeCount - 1}.`);

    // The tricky bit: We need to check to see if the document got modified
    // during the file write operation, because if we don't and just reset the
    // dirty flag, we will fail to write the new version until the _next_ time
    // the document changes. We check two things to make the determination:
    //
    // * The length of the changes array. Different lengths mean we are still
    //   dirty.
    //
    // * The first change as stored in the instance. If this isn't the same as
    //   what we wrote, it means that the document was re-created.

    if ((changeCount !== changes.length) || (firstChange !== changes[0])) {
      // The document was modified while writing was underway. We just recurse
      // to guarantee that the new version isn't lost.
      this._log.info('Document modified during write operation.');
      return this._waitThenWriteChanges();
    }

    // The usual case: Everything is fine.
    this._changesDirty = false;
    return true;
  }

  /**
   * Reads the document change list if it is not yet loaded.
   */
  async _readChangesIfNecessary() {
    if (this._changes !== null) {
      // Already in memory; no need to read.
      return;
    }

    if (this._changesPromise === null) {
      // This is the first time we've needed the changes. Initiate a read.
      this._changesPromise = this._readChanges();
    }

    // Wait for the pending read to complete.
    await this._changesPromise;
  }

  /**
   * Reads the document file, returning the document contents (an array of
   * changes). If the document file doesn't exist, this will initialize the
   * in-memory model with an empty document but does _not_ mark the document
   * as needing to be written to disk. If the file exists but contains invalid
   * contents, it is treated as if it exists but is empty.
   *
   * @returns {array<DocumentChange>} The document contents.
   */
  async _readChanges() {
    if (!await afs.exists(this._path)) {
      // File doesn't actually exist. Just initialize an empty change list.
      this._changes = [];
      this._needsMigration = false;
      this._log.info('New document.');
      return this._changes;
    }

    // The file exists. Read it and attempt to parse it.
    this._log.detail('Reading from disk...');

    const encoded = await afs.readFile(this._path);
    let contents = null;
    let needsMigration = true;

    try {
      contents = Decoder.decodeJson(encoded);
      TObject.withExactKeys(contents, ['version', 'changes']);
      if (contents.version !== this._formatVersion) {
        this._log.warn('Ignoring data with a mismatched format version. ' +
            `Got ${contents.version}, expected ${this._formatVersion}`);
        contents = null;
      }
    } catch (e) {
      this._log.warn('Ignoring malformed data (bad JSON or unversioned).', e);
      contents = null;
    }

    if (contents === null) {
      this._changes = [];
      this._log.info('New document (because existing data is old or bad).');
    } else {
      // `slice(0)` makes a mutable clone. Ideally, we'd just use immutable
      // data structures all the way through, but (TODO) this is reasonable
      // for now.
      this._changes = contents.changes.slice(0);
      needsMigration = false;
      this._log.info('Read from disk.');
    }

    this._needsMigration = needsMigration;
    return this._changes;
  }

  /**
   * Reads the document storage if it has not yet been loaded.
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
    this._log.detail('Reading from disk...');

    const files = await afs.readdir(this._storageDir);
    const storage = new Map();
    for (const f of files) {
      const buf = await afs.readFile(path.resolve(this._storageDir, f));
      const storagePath = LocalDoc._storagePathForFsName(f);
      storage.set(storagePath, buf);
      this._log.detail(`Read: ${storagePath}`);
    }

    // Only set the instance variables after all the reading is done.
    this._storage             = storage;
    this._dirtyValues         = new Map();
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
    this._log.info(`Value(s) to write: ${this._dirtyValues.size}`);

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
    const dirtyValues         = this._dirtyValues;

    this._storageIsDirty      = false;
    this._storageNeedsErasing = false;
    this._dirtyValues         = new Map();

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
      await afs.writeFile(fsPath, data.toBuffer());
      this._log.info(`Wrote: ${storagePath}`);
    }

    // Check to see if more updates happened while the writing was being done.
    // If so, recurse to iterate.

    if (this._storageIsDirty) {
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
   * converted to periods (`.`), the latter which is not a valid character for
   * a storage path component.
   *
   * @param {string} storagePath The storage path.
   * @returns {string} The file name to use when accessing `path`.
   */
  _fsPathForStorage(storagePath) {
    // `slice(1)` trims off the initial slash.
    const fileName = storagePath.slice(1).replace(/\//g, '.');
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
    return `/${fsName.replace(/\./g, '/')}`;
  }
}
