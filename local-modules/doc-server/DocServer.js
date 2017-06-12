// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import weak from 'weak';

import { Coder } from 'content-store';
import { FrozenDelta } from 'doc-common';
import { DEFAULT_DOCUMENT, Hooks } from 'hooks-server';
import { Logger } from 'see-all';
import { ProductInfo } from 'server-env';
import { TBoolean, TString } from 'typecheck';
import { Singleton } from 'util-common';

import DocControl from './DocControl';

/** {FrozenDelta} Default contents when creating a new document. */
const DEFAULT_TEXT = FrozenDelta.coerce(DEFAULT_DOCUMENT);

/**
 * {FrozenDelta} Message used as document to indicate a major validation error.
 */
const ERROR_NOTE = FrozenDelta.coerce(
  [{ insert: '(Recreated document due to validation error(s).)\n' }]);

/**
 * {FrozenDelta} Message used as document instead of migrating documents from
 * old format versions. */
const MIGRATION_NOTE = FrozenDelta.coerce(
  [{ insert: '(Recreated document due to format version skew.)\n' }]);

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

    /**
     * {Map<string,Promise<DocControl|null>>} Map from document IDs to a
     * promise for a document controller for the so-IDed document. A promise
     * can resolve to `null` if the pending request turned out to _not_ request
     * initialization of a missing document.
     */
    this._pending = new Map();

    /**
     * {FrozenBuffer} The document format version to use for new documents and
     * to expect in existing documents.
     */
    this._formatVersion = Coder.encode(ProductInfo.INFO.version);
  }

  /**
   * Gets the document controller for the document with the given ID. If the
   * document doesn't exist, it gets initialized.
   *
   * @param {string} docId The document ID.
   * @returns {DocControl} The corresponding document accessor.
   */
  async getDoc(docId) {
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
  async getDocOrNull(docId) {
    return this._getDoc(docId, false);
  }

  /**
   * Common code for both `getDoc*()` methods, which performs "traffic control"
   * on the requests.
   *
   * @param {string} docId The document ID.
   * @param {boolean} initIfMissing If `true`, initializes a nonexistent doc
   *   instead of returning `null`.
   * @returns {DocControl|null} The corresponding document accessor, or `null`
   *   if there is no such document _and_ we were not asked to fill in missing
   *   docs.
   */
  async _getDoc(docId, initIfMissing) {
    TString.nonempty(docId);
    TBoolean.check(initIfMissing);

    // Make a temporary logger specific to this doc.
    const docLog = log.withPrefix(`[${docId}]`);

    const already = this._controls.get(docId);
    if (already && !weak.isDead(already)) {
      docLog.info('Retrieved from in-memory cache.');
      return weak.get(already);
    }

    const pending = this._pending.get(docId);
    if (pending) {
      // There is already a request for this document in flight. Use its result.
      docLog.info('Awaiting result from parallel request.');
      const result = await pending;
      if ((result === null) && initIfMissing) {
        // This request wants a missing doc to be initialized, but the formerly
        // pending one didn't. So, we try again. (We will eventually win the
        // race, if any.)
        docLog.info('Retrying parallel request.');
        return this._getDoc(docId, true);
      }
      docLog.info('Satisfied parallel request.');
      return result;
    }

    // The controller is not already cached, and its construction is not
    // currently pending. Start constructing it, and register it as pending, so
    // as to let other requesters find it (per above).

    docLog.info('Contructing controller.');
    const resultPromise = this._makeController(docId, initIfMissing);
    this._pending.set(docId, resultPromise);

    // Get the construction result.
    const result = await resultPromise;

    // The construction action is no longer pending.
    this._pending.delete(docId);

    if (result === null) {
      docLog.info('No such document.');
    } else {
      // Set up the weak reference so the controller won't hang around once it's
      // no longer being used, and store that ref in the main `_controls` map.
      const resultRef = weak(result, this._reapDocument.bind(this, docId));
      this._controls.set(docId, resultRef);
      docLog.info('Controller constructed.');
    }

    return result;
  }

  /**
   * Constructs and returns a `DocControl` for a specific document, initializing
   * it if requested (or alternatively returning `null` if nonexistent).
   *
   * @param {string} docId The document ID.
   * @param {boolean} initIfMissing If `true`, initializes a nonexistent doc
   *   instead of returning `null`.
   * @returns {DocControl|null} The corresponding document accessor, or `null`
   *   if there is no such document _and_ we were not asked to fill in missing
   *   docs.
   */
  async _makeController(docId, initIfMissing) {
    // Make a temporary logger specific to this doc.
    const docLog = log.withPrefix(`[${docId}]`);

    const docStorage   = await Hooks.docStore.getFile(docId);
    const result       = new DocControl(docStorage, this._formatVersion);
    const docStatus    = await result.validationStatus();
    const docNeedsInit = (docStatus !== DocControl.STATUS_OK);
    let   firstText    = DEFAULT_TEXT;

    if (docStatus === DocControl.STATUS_MIGRATE) {
      // **TODO:** Ultimately, this code path will evolve into forward
      // migration of documents found to be in older formats. For now, we just
      // fall through to the document creation logic below, which will leave
      // a note what's going on in the document contents.
      docLog.info('Needs migration. (But just noting that fact for now.)');
      firstText = MIGRATION_NOTE;
    } else if (docStatus === DocControl.STATUS_ERROR) {
      // **TODO:** Ultimately, it should be a Really Big Deal if we find
      // ourselves here. We might want to implement some form of "hail mary"
      // attempt to recover _something_ of use from the document storage.
      docLog.info('Major problem with stored data!');
      firstText = ERROR_NOTE;
    }

    if (!initIfMissing) {
      if (docStatus === DocControl.STATUS_NOT_FOUND) {
        return null;
      }
    }

    if (docNeedsInit) {
      await result.create(firstText);
    }

    return result;
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
