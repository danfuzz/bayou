// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { DocumentChange, Timestamp } from 'doc-common';
import { DEFAULT_DOCUMENT, Hooks } from 'hooks-server';
import { TString } from 'typecheck';

import DocControl from './DocControl';

/**
 * {DocServer|null} The unique instance of this class. Initialized in the
 * `THE_INSTANCE` getter below.
 */
let THE_INSTANCE = null;

/**
 * Interface between this module and the storage layer. This class is
 * responsible for instantiating and tracking `DocControl` instances, such that
 * only one instance is created per actual document.
 */
export default class DocServer {
  /** {DocServer} The unique instance of this class. */
  static get THE_INSTANCE() {
    if (THE_INSTANCE === null) {
      THE_INSTANCE = new DocServer();
    }

    return THE_INSTANCE;
  }

  /**
   * Constructs an instance. This is not meant to be used publicly.
   */
  constructor() {
    if (THE_INSTANCE !== null) {
      throw new Error('Attempt to construct a second instance.');
    }

    /**
     * {Map<string,DocControl>} Map from document IDs to their corresponding
     * document controllers.
     */
    this._controls = new Map();
  }

  /**
   * Gets the document controller for the document with the given ID. If the
   * document doesn't exist, it gets initialized.
   *
   * @param {string} docId The document ID.
   * @returns {DocControl} The corresponding document accessor.
   */
  getDoc(docId) {
    TString.nonempty(docId);

    const already = this._controls.get(docId);
    if (already) {
      return already;
    }

    const docStorage = Hooks.docStore.getDocument(docId);

    if (!docStorage.exists()) {
      // Initialize the document with static content (for now).
      const firstChange =
        new DocumentChange(0, Timestamp.now(), DEFAULT_DOCUMENT, null);
      docStorage.changeAppend(firstChange);
    }

    const result = new DocControl(docStorage);
    this._controls.set(docId, result);
    return result;
  }
}
