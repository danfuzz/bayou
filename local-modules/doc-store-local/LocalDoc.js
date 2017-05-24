// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import afs from 'async-file';

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

    /** {string} Path to the storage for this document. */
    this._path = docPath;

    /**
     * {array<DocumentChange>|null} Array of changes. Index `n` contains the
     * change that produces version number `n`. `null` indicates that the array
     * is not yet initialized.
     */
    this._changes = null;

    /**
     * {Promise<array<DocumentChange>>|null} Promise for the value of
     * `_changes`. Becomes non-`null` during the first call to
     * `_readIfNecessary()` and is used to prevent superfluous re-reading.
     */
    this._changesPromise = null;

    /**
     * Does the document need to be written to disk? This is set to `true` on
     * updates and back to `false` once the write has been done.
     */
    this._dirty = false;

    /**
     * Does the document need to be "migrated?" In this case, `true` indicates
     * that the document file exists but could not actually be read and parsed
     * successfully. This variable is set in `_readDocument()`.
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

    // **Note:** This call _synchronously_ (and promptly) indicates that writing
    // needs to happen, but the actual writing takes place asynchronously.
    this._needsWrite();
  }

  /**
   * Implementation as required by the superclass.
   *
   * @returns {Int|null} The version number of this document.
   */
  async _impl_currentVerNum() {
    await this._readIfNecessary();
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
    await this._readIfNecessary();

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
    await this._readIfNecessary();

    if (change.verNum !== this._changes.length) {
      // Not the right `verNum`. This is typically because there was an append
      // race, and this is the losing side.
      return false;
    }

    this._changes[change.verNum] = change;

    // **Note:** This call _synchronously_ (and promptly) indicates that writing
    // needs to happen, but the actual writing takes place asynchronously.
    this._needsWrite();

    return true;
  }

  /**
   * Implementation as required by the superclass.
   *
   * @returns {boolean} `true` iff the document needs migration.
   */
  async _impl_needsMigration() {
    await this._readIfNecessary();
    return this._needsMigration;
  }

  /**
   * Indicates that the document is "dirty" and needs to be written. This
   * method acts (and returns) promptly. It will kick off a timed callback
   * to actually perform the writing operation if one isn't already pending.
   */
  _needsWrite() {
    if (this._dirty) {
      // Already marked dirty, which means there's nothing more to do. When
      // the already-scheduled timer fires, it will pick up the current change.
      this._log.detail('Already marked dirty.');
      return;
    }

    // Mark the document dirty, and queue up the writer.

    this._dirty = true;
    this._log.detail(`Marked dirty at version ${this._changes.length}.`);

    // **TODO:** If we want to catch write errors (e.g. filesystem full), here
    // is where we need to do it.
    this._waitThenWrite();
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
  async _waitThenWrite() {
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
      return this._waitThenWrite();
    }

    // The usual case: Everything is fine.
    this._dirty = false;
    return true;
  }

  /**
   * Reads the document if it is not yet loaded.
   */
  async _readIfNecessary() {
    if (this._changes !== null) {
      // Already in memory; no need to read.
      return;
    }

    if (this._changesPromise === null) {
      // This is the first time we've needed the changes. Initiate a read.
      this._changesPromise = this._readDocument();
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
  async _readDocument() {
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
}
