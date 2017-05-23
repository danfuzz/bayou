// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import afs from 'async-file';
import fs from 'fs';

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
    // Start by checking the existence of the file. We do this first, so that
    // the subsequent logic can be synchronous.
    const fileExists = await afs.exists(this._path);

    if (this._changes !== null) {
      // Whether or not the file exists, the document is considered to exist
      // because it has a non-empty in-memory model. (For example, it might have
      // been `create()`d but not yet stored to disk.)
      return true;
    } else if (!fileExists) {
      // The file doesn't exist, and (per above) there's no in-memory model.
      return false;
    } else {
      // The file exists, but we don't know if it's valid. Let the document
      // reader code make that determination. An error in reading indicates that
      // the document doesn't effectively exist.
      try {
        await this._readIfNecessary();
        return true;
      } catch (e) {
        return false;
      }
    }
  }

  /**
   * Implementation as required by the superclass.
   */
  async _impl_create() {
    this._changes = [];
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
   * @param {DocumentChange} change The change to write.
   */
  async _impl_changeAppend(change) {
    await this._readIfNecessary();

    if (change.verNum !== this._changes.length) {
      throw new Error(`Invalid version number: ${change.verNum}.`);
    }

    this._changes[change.verNum] = change;
    this._needsWrite();
  }

  /**
   * Indicates that the document is "dirty" and needs to be written.
   */
  _needsWrite() {
    if (this._dirty) {
      // Already marked dirty. Nothing more to do.
      this._log.detail('Already marked dirty.');
      return;
    }

    // Mark the document dirty, and queue up the writer.

    this._dirty = true;
    this._log.detail('Marked dirty.');

    PromDelay.resolve(DIRTY_DELAY_MSEC).then(() => {
      this._log.detail('Writing to disk...');

      const contents = { version: this._formatVersion, changes: this._changes };
      const encoded = Encoder.encodeJson(contents, true);
      fs.writeFileSync(this._path, encoded, { encoding: 'utf8' });
      this._dirty = false;
      this._log.info('Written to disk.');
    });
  }

  /**
   * Reads the document if it is not yet loaded.
   */
  async _readIfNecessary() {
    if (this._changes !== null) {
      // Alread in memory; no need to read.
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
   * changes).
   *
   * @returns {array<DocumentChange>} The document contents.
   */
  async _readDocument() {
    if (!await afs.exists(this._path)) {
      // File doesn't actually exist. Just initialize an empty change list.
      this._changes = [];
      this._log.info('New document.');
      return this._changes;
    }

    // The file exists. Read it and attempt to parse it.
    this._log.detail('Reading from disk...');

    const encoded = await fs.readFile(this._path);
    let contents = null;

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
      this._log.info('Read from disk.');
    }

    return this._changes;
  }
}
