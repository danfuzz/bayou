// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import util from 'util';

import ShareDB from 'sharedb';
import rich_text from 'rich-text';

import default_document from './default_document';
import log from './log';

/**
 * Collection ID we use. **Note:** We use ShareDB in a very degenerate way, in
 * that we only ever use it to manage a single document.
 */
const DOC_COLL_ID = 'the-collection-id';

/** Document ID we use. See note on `DOC_COLL_ID`. */
const DOC_ID = 'the-document-id';

/** Document type we use. */
const DOC_TYPE = rich_text.type;

// Tell ShareDB about the doc type.
ShareDB.types.register(DOC_TYPE);

/**
 * Representation of a persistent document, along with a set of clients.
 *
 * TODO: Be persistent.
 */
export default class Document {
  /**
   * Constructs an instance.
   */
  constructor() {
    /** "DB" instance. */
    this._db = new ShareDB();

    /** Main server-side connection to the db. */
    this._connection = this._db.connect();

    /** The sole document being managed, via the server connection. */
    this._doc = this._connection.get(DOC_COLL_ID, DOC_ID);

    // Used below to resolve `ready`.
    let resolve;

    /** Promise that gets resolved when the document is ready. */
    this._ready = new Promise((res, rej) => { resolve = res; });

    // Initialize the document with static content (for now), and resolve
    // `ready` when done.
    this._doc.create(default_document, DOC_TYPE.name, (error) => {
      if (error) {
        throw error;
      }
      resolve(true);
    });
  }

  /**
   * Returns a promise that is resolved when the document is ready. This occurs
   * after any initial setup (e.g. loading from stable storage).
   */
  ready() {
    return this._ready;
  }

  /**
   * Returns a promise for an instantaneous snapshot of the full document
   * contents. Ultimate result is an object that maps `data` to the snapshot
   * data and `version` to the version number.
   */
  snapshot() {
    const doc = this._doc;

    return new Promise((resolve, reject) => {
      this._ready.then(() => {
        doc.fetch((error) => {
          if (error) {
            reject(error);
          } else {
            resolve({ data: doc.data, version: doc.version });
          }
        });
      });
    });
  }
}
