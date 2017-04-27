// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import weak from 'weak';

import { DocumentChange, Timestamp } from 'doc-common';
import { DEFAULT_DOCUMENT, Hooks } from 'hooks-server';
import { Logger } from 'see-all';
import { TBoolean, TString } from 'typecheck';
import { Singleton } from 'util-common';

import DocControl from './DocControl';

/** {Logger} Logger for this module. */
const log = new Logger('doc-server');

/**
 * Interface between this module and the storage layer. This class is
 * responsible for instantiating and tracking `DocControl` instances, such that
 * only one instance is created per actual document.
 *
 * This class is notably responsible for the lifecycle management of
 * document-related objects, in particular making sure that such objects have
 * an opportunity to get GC'ed once they're no longer in active use.
 */
export default class DocServer extends Singleton {
  /**
   * Constructs an instance. This is not meant to be used publicly.
   */
  constructor() {
    super();

    /**
     * {Map<string,Weak<DocControl>>} Map from document IDs to a
     * weak-reference-wrapped document controller for the so-IDed document.
     */
    this._controls = new Map();
  }

  /**
   * Gets the document controller for the document with the given ID. If the
   * document doesn't exist, it gets initialized.
   *
   * @param {string} docId The document ID.
   * @returns {Promise<DocControl>} Promise for the corresponding document
   *   accessor.
   */
  getDoc(docId) {
    return this._getDoc(docId, true);
  }

  /**
   * Gets the document controller for the document with the given ID. If the
   * document doesn't exist, this returns `null`.
   *
   * @param {string} docId The document ID.
   * @returns {Promise<DocControl|null>} Promise for the corresponding document
   *   accessor, or for `null` if there is no such document.
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
   * @returns {Promise<DocControl|null>} A promise for the corresponding
   *   document accessor, or `null` if there is no such document _and_ we were
   *   not asked to fill in missing docs.
   */
  _getDoc(docId, initIfMissing) {
    TString.nonempty(docId);
    TBoolean.check(initIfMissing);

    const already = this._controls.get(docId);
    if (already && !weak.isDead(already)) {
      log.info(`Already have: ${docId}`);
      return Promise.resolve(weak.get(already));
    }

    const docStorage = Hooks.docStore.getDocument(docId);

    if (docStorage.exists()) {
      log.info(`Retrieving document: ${docId}`);
    } else {
      if (!initIfMissing) {
        log.info(`No document: ${docId}`);
        return Promise.resolve(null);
      }

      log.info(`New document: ${docId}`);

      // Initialize the document with static content (for now).
      const firstChange =
        new DocumentChange(0, Timestamp.now(), DEFAULT_DOCUMENT, null);
      docStorage.changeAppend(firstChange);
    }

    const result = new DocControl(docStorage);
    const resultRef = weak(result, this._reapDocument.bind(this, docId));
    this._controls.set(docId, resultRef);
    return Promise.resolve(result);
  }

  /**
   * Weak reference callback that removes a collected document object from the
   * document map.
   *
   * @param {string} docId ID of the document to remove.
   */
  _reapDocument(docId) {
    this._controls.delete(docId);
    log.info(`Reaped idle document: ${docId}`);
  }
}
