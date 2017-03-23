// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { DocumentChange, Timestamp } from 'doc-common';
import { DEFAULT_DOCUMENT, Hooks } from 'hooks-server';
import { TBoolean, TString } from 'typecheck';
import { Singleton } from 'util-common';

import DocControl from './DocControl';

/**
 * Interface between this module and the storage layer. This class is
 * responsible for instantiating and tracking `DocControl` instances, such that
 * only one instance is created per actual document.
 */
export default class DocServer extends Singleton {
  /**
   * Constructs an instance. This is not meant to be used publicly.
   */
  constructor() {
    super();

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
    return this._getDoc(docId, true);
  }

  /**
   * Gets the document controller for the document with the given ID. If the
   * document doesn't exist, this returns `null`.
   *
   * @param {string} docId The document ID.
   * @returns {DocControl|null} The corresponding document accessor, or `null`
   *   if there is no such document.
   */
  getDocOrNull(docId) {
    return this._getDoc(docId, false);
  }

  /**
   * Common code for both `getDoc*()` methods.
   *
   * @param {string} docId The document ID.
   * @param {boolean} initIfMissing If `true`, initializes a nonexistent doc
   *   instead of returning `null`.
   * @returns {DocControl|null} The corresponding document accessor, or `null`
   *   if there is no such document _and_ we were not asked to fill in missing
   *   docs.
   */
  _getDoc(docId, initIfMissing) {
    TString.nonempty(docId);
    TBoolean.check(initIfMissing);

    const already = this._controls.get(docId);
    if (already) {
      return already;
    }

    const docStorage = Hooks.docStore.getDocument(docId);

    if (!docStorage.exists()) {
      if (!initIfMissing) {
        return null;
      }

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
