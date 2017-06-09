// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import afs from 'async-file';
import path from 'path';

import { BaseContentStore } from 'content-store';
import { Logger } from 'see-all';
import { Dirs } from 'server-env';

import LocalFile from './LocalFile';

/** {Logger} Logger for this module. */
const log = new Logger('local-doc');

/**
 * Document storage implementation that stores everything in the
 * locally-accessible filesystem.
 */
export default class LocalContentStore extends BaseContentStore {
  /**
   * Constructs an instance. This is not meant to be used publicly.
   */
  constructor() {
    super();

    /** {Map<string, LocalFile>} Map from document IDs to document instances. */
    this._docs = new Map();

    /** {string} The directory for document storage. */
    this._dir = path.resolve(Dirs.VAR_DIR, 'docs');

    /**
     * {boolean} `true` iff the document directory is known to exist. Set to
     * `true` in `_ensureDocDirectory()`.
     */
    this._ensuredDir = false;

    log.info(`Document directory: ${this._dir}`);
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {string} docId The ID of the document to access.
   * @returns {BaseFile} Accessor for the document in question.
   */
  async _impl_getDocument(docId) {
    const already = this._docs.get(docId);

    if (already) {
      return already;
    }

    await this._ensureDocDirectory();

    const result = new LocalFile(docId, this._documentPath(docId));
    this._docs.set(docId, result);
    return result;
  }

  /**
   * Gets the filesystem path for the document with the given ID.
   *
   * @param {string} docId The document ID.
   * @returns {string} The corresponding filesystem path.
   */
  _documentPath(docId) {
    return path.resolve(this._dir, docId);
  }

  /**
   * Ensures the document storage directory exists. This will only ever check
   * once (on first document construction attempt), which notably means that
   * things will break if something removes the document directory without
   * restarting the server.
   */
  async _ensureDocDirectory() {
    if (this._ensuredDir) {
      return;
    }

    if (await afs.exists(this._dir)) {
      log.detail('Document directory already exists.');
    } else {
      await afs.mkdir(this._dir);
      log.info('Created document directory.');
    }

    this._ensuredDir = true;
  }
}
