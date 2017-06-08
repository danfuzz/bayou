// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import weak from 'weak';

import { FrozenDelta } from 'doc-common';
import { Coder } from 'doc-store';
import { DEFAULT_DOCUMENT, Hooks } from 'hooks-server';
import { Logger } from 'see-all';
import { ProductInfo } from 'server-env';
import { TBoolean, TString } from 'typecheck';
import { Singleton } from 'util-common';

import DocControl from './DocControl';

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
   * Common code for both `getDoc*()` methods.
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

    const docStorage   = await Hooks.docStore.getDocument(docId);
    const result       = new DocControl(docStorage, this._formatVersion);
    const docStatus    = await result.validationStatus();
    const docNeedsInit = (docStatus !== DocControl.STATUS_OK);
    let   firstText    = DEFAULT_DOCUMENT;

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
        docLog.info('No such document.');
        return null;
      }
    }

    if (docNeedsInit) {
      await result.create(firstText);
    }

    const resultRef = weak(result, this._reapDocument.bind(this, docId));
    this._controls.set(docId, resultRef);
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
