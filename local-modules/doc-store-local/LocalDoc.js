// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';

import { ApiCommon, Encoder } from 'api-common';
import { BaseDoc } from 'doc-store';
import { SeeAll } from 'see-all';
import { TObject } from 'typecheck';
import { PromDelay } from 'util-common';


/** {SeeAll} Logger for this module. */
const log = new SeeAll('local-doc');

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
     * Does the document need to be written to disk? This is set to `true` on
     * updates and back to `false` once the write has been done.
     */
    this._dirty = false;

    /** {SeeAll} Logger specific to this document's ID. */
    this._log = log.withPrefix(`[${docId}]`);

    this._log.info('Constructed.');
    this._log.detail(`Path: ${this._path}`);
  }

  /**
   * Implementation as required by the superclass.
   *
   * @returns {boolean} `true` iff this document exists.
   */
  _impl_exists() {
    return fs.existsSync(this._path);
  }

  /**
   * Implementation as required by the superclass.
   */
  _impl_create() {
    this._changes = [];
    this._needsWrite();
  }

  /**
   * Implementation as required by the superclass.
   *
   * @returns {int} The version number of this document.
   */
  _impl_currentVerNum() {
    this._readIfNecessary();
    const len = this._changes.length;
    return (len === 0) ? null : (len - 1);
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {int} verNum The version number for the desired change.
   * @returns {DocumentChange|null|undefined} The change with `verNum` as
   *   indicated or a nullish value if there is no such change.
   */
  _impl_changeRead(verNum) {
    this._readIfNecessary();
    return this._changes[verNum];
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {DocumentChange} change The change to write.
   */
  _impl_changeAppend(change) {
    this._readIfNecessary();
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

      const contents = {version: this._formatVersion, changes: this._changes};
      const encoded = Encoder.encodeJson(contents);
      fs.writeFileSync(this._path, encoded, {encoding: 'utf8'});
      this._dirty = false;
      this._log.info('Written to disk.');
    });
  }

  /**
   * Reads the document if it is not yet loaded.
   */
  _readIfNecessary() {
    if (this._changes !== null) {
      // No need.
      return;
    }

    if (this._impl_exists()) {
      this._log.detail('Reading from disk...');

      const encoded = fs.readFileSync(this._path);
      let contents = null;

      try {
        contents = ApiCommon.valueFromJson(encoded);
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
    } else {
      // File doesn't actually exist. Just initialize an empty change list.
      this._changes = [];
      this._log.info('New document.');
    }
  }
}
