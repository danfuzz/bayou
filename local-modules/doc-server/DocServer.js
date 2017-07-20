// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import weak from 'weak';

import { Codec } from 'api-common';
import { Hooks } from 'hooks-server';
import { Logger } from 'see-all';
import { TString } from 'typecheck';
import { Singleton } from 'util-common';

import FileComplex from './FileComplex';

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
     * {Codec} Codec instance to use. **Note:** As of this writing, `Codec` is a
     * singleton, but the intention is for it to stop being so.
     */
    this._codec = Codec.theOne;

    /**
     * {Map<string,Weak<Promise<FileComplex>>>} Map from document IDs to a
     * weak-reference-wrapped promise to the `FileComplex` for the so-IDed
     * document. It's weak because we don't want its presence here to preclude
     * it from getting GC'ed. It's a promise because it can only be initialized
     * in an asynchronous fashion.
     */
    this._complexes = new Map();
  }

  /**
   * Gets the `FileComplex` for the document with the given ID. It is okay (not
   * an error) if the underlying file doesn't happen to exist.
   *
   * @param {string} docId The document ID.
   * @returns {FileComplex} The corresponding `FileComplex`.
   */
  async getFileComplex(docId) {
    TString.nonempty(docId);

    // Return the cached result (a promise, which might already be resolved), if
    // it turns out to exist.

    const already = this._complexes.get(docId);
    if (already && !weak.isDead(already)) {
      const result = await weak.get(already);

      result.log.info('Retrieved cached complex.');
      return result;
    }

    // Asynchronously construct the ultimate result.

    const resultPromise = (async () => {
      const file   = await Hooks.theOne.contentStore.getFile(docId);
      const result = new FileComplex(this._codec, file);

      result.log.info('Constructed new complex.');
      return result;
    })();

    // Store the (weak reference to) the promise for the result in the cache,
    // and return it.

    const resultRef = weak(resultPromise, this._reapDocument.bind(this, docId));

    this._complexes.set(docId, resultRef);
    return resultPromise;
  }

  /**
   * Gets the document controller for the document with the given ID. If the
   * document doesn't exist (that is, the underlying file storage doesn't
   * exist) or the document exists but has invalid content, it gets initialized.
   *
   * @param {string} docId The document ID.
   * @returns {DocControl} The corresponding document controller.
   */
  async getDoc(docId) {
    const complex = await this.getFileComplex(docId);

    await complex.initIfMissingOrInvalid();
    return complex.docControl;
  }

  /**
   * Gets the document controller for the document with the given ID. If the
   * document doesn't exist (that is, the underlying file storage doesn't
   * exist), this method returns `null`. If the document exists but has invalid
   * content, this will re-initialize the content.
   *
   * @param {string} docId The document ID.
   * @returns {DocControl|null} The corresponding document controller, or `null`
   *   if there is no such document.
   */
  async getDocOrNull(docId) {
    const complex = await this.getFileComplex(docId);
    const exists  = await complex.file.exists();

    if (exists) {
      await complex.initIfMissingOrInvalid();
      return complex.docControl;
    } else {
      return null;
    }
  }

  /**
   * Weak reference callback that removes a collected document object from the
   * document map.
   *
   * @param {string} docId ID of the document to remove.
   */
  _reapDocument(docId) {
    this._complexes.delete(docId);
    log.info(`Reaped idle document: ${docId}`);
  }
}
