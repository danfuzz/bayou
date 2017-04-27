// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import path from 'path';

import { BaseDocStore } from 'doc-store';
import { Logger } from 'see-all';
import { Dirs, ProductInfo } from 'server-env';

import LocalDoc from './LocalDoc';

/** {Logger} Logger for this module. */
const log = new Logger('local-doc');

/**
 * Document storage implementation that stores everything in the
 * locally-accessible filesystem.
 */
export default class LocalDocStore extends BaseDocStore {
  /**
   * Constructs an instance. This is not meant to be used publicly.
   */
  constructor() {
    super();

    /** {Map<string, LocalDoc>} Map from document IDs to document instances. */
    this._docs = new Map();

    /** {string} The directory for document storage. */
    this._dir = path.resolve(Dirs.VAR_DIR, 'docs');

    /**
     * {string} The document format version to use. This is always set to be
     * the same as the product version, to be maximally conservative about what
     * to accept. _Other_ implementations of the document store interface will
     * rightly have a looser correspondence between product version and document
     * format; but _this_ implementation is more geared toward active
     * development, and as such we want to make it easy to cleanly ignore old
     * formats.
     */
    this._formatVersion = ProductInfo.INFO.version;

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

    const result =
      new LocalDoc(this._formatVersion, docId, this._documentPath(docId));
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
