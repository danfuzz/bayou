// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import util from 'util';

import ShareDB from 'sharedb';
import rich_text from 'rich-text';

import default_document from './default_document';

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
    this._doc = this._connection.get('the-collection', 'the-doc');

    // Used below to resolve `ready`.
    let resolve;

    /** Promise that gets resolved when the document is ready. */
    this._ready = new Promise((res, rej) => { resolve = res; });

    // Initialize the document with static content (for now), and resolve
    // `ready` when done.
    this._doc.fetch((error) => {
      if (error) {
        throw error;
      }

      this._doc.create(default_document, DOC_TYPE.name, () => { resolve(true); });
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
   * contents.
   */
  snapshot() {
    return new Promise((resolve, reject) => {
      this._ready.then(() => {
        this._doc.fetch((error) => {
          if (error) {
            reject(error);
          } else {
            resolve(this._doc.data);
          }
        });
      });
    });
  }
}
