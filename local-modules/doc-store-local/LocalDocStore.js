// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import path from 'path';

import { BaseDocStore } from 'doc-store';
import { SeeAll } from 'see-all';
import { Dirs } from 'server-env';

import LocalDoc from './LocalDoc';

/** {SeeAll} Logger for this module. */
const log = new SeeAll('local-doc');

/**
 * {LocalDocStore|null} The unique instance of this class. Initialized in the
 * `THE_INSTANCE` getter below.
 */
let THE_INSTANCE = null;

/**
 * Document storage implementation that stores everything in the
 * locally-accessible filesystem.
 */
export default class LocalDocStore extends BaseDocStore {
  /** {LocalDocStore} The unique instance of this class. */
  static get THE_INSTANCE() {
    if (THE_INSTANCE === null) {
      THE_INSTANCE = new LocalDocStore();
    }

    return THE_INSTANCE;
  }

  /**
   * Constructs an instance. This is not meant to be used publicly.
   */
  constructor() {
    super();

    if (THE_INSTANCE !== null) {
      throw new Error('Attempt to construct a second instance.');
    }

    /** {Map<string, LocalDoc>} Map from document IDs to document instances. */
    this._docs = new Map();

    /** {string} The directory for document storage. */
    this._dir = path.resolve(Dirs.VAR_DIR, 'docs');

    // Create the document storage directory if it doesn't yet exist.
    if (!fs.existsSync(this._dir)) {
      fs.mkdirSync(this._dir);
    }

    log.info(`Document directory: ${this._dir}`);
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {string} docId The ID of the document to access.
   * @returns {BaseDoc} Accessor for the document in question.
   */
  _impl_getDocument(docId) {
    const already = this._docs.get(docId);

    if (already) {
      return already;
    }

    const result = new LocalDoc(docId, this._documentPath(docId));
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
    return path.resolve(this._dir, `${docId}.json`);
  }
}
