// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import BaseDocStore from './BaseDocStore';
import LocalDoc from './LocalDoc';

/**
 * {LocalDocStore|null} The unique instance of this class. Initialized in the
 * `THE_INSTANCE` getter below.
 */
let THE_INSTANCE = null;

/**
 * Document storage implementation that keeps everything in memory.
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
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {string} docId The ID of the document to access.
   * @returns {BaseDoc} Accessor for the document in question.
   */
  _impl_getDocument(docId) {
    return new LocalDoc(docId);
  }
}
