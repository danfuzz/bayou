// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import weak from 'weak';

import { TheModule as appCommon_TheModule } from '@bayou/app-common';
import { Storage } from '@bayou/config-server';
import { Logger } from '@bayou/see-all';
import { Singleton } from '@bayou/util-common';

import FileComplex from './FileComplex';

/** {Logger} Logger for this module. */
const log = new Logger('doc-server');

/**
 * Interface between this module and the storage layer. This class is
 * responsible for instantiating and tracking `BodyControl` instances, such that
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

    /** {Codec} Codec instance to use. */
    this._codec = appCommon_TheModule.fullCodec;

    /**
     * {Map<string, Weak<FileComplex>|Promise<FileComplex>>} Map from document
     * IDs to either a weak-reference or a promise to a {@link FileComplex}, for
     * the so-IDed document. During asynchrounous construction, the binding is
     * to a promise, and once constructed it becomes a weak reference. The weak
     * reference is made because we don't want its presence here to preclude it
     * from getting GC'ed.
     */
    this._complexes = new Map();

    Object.freeze(this);
  }

  /**
   * Gets the `FileComplex` for the document with the given ID. It is okay (not
   * an error) if the underlying file doesn't happen to exist.
   *
   * @param {string} documentId The document ID.
   * @returns {FileComplex} The corresponding `FileComplex`.
   */
  async getFileComplex(documentId) {
    // **Note:** We don't make an `async` back-end call to check the
    // `documentId` here, because that would be a waste if it turns out we've
    // already cached a valid result. Once we determine that we need to
    // construct a new complex (below), we'll call through to the back-end to
    // get a file ID, and that call implicitly validates the document ID.
    Storage.dataStore.checkDocumentIdSyntax(documentId);

    // Look for a cached or in-progress result.

    const already = this._complexes.get(documentId);
    if (already) {
      // There's something in the cache. There are two possibilities...
      if (already instanceof Promise) {
        // It's a _promise_ for a `FileComplex`. This happens if we got a
        // request for a file in parallel with it getting constructed.
        const result = await already;
        result.log.event.parallelRequest();
        return result;
      } else {
        // It's a weak reference. If not dead, it refers to a `FileComplex`.
        if (!weak.isDead(already)) {
          // We've seen cases where a weakly-referenced object gets collected
          // and replaced with an instance of a different class. If this check
          // throws an error, that's what's going on here. (This is evidence of
          // a bug in Node or in the `weak` package.)
          const result = FileComplex.check(weak.get(already));

          result.log.event.foundInCache();
          return result;
        }
        // The weak reference is dead. We'll fall through and construct a new
        // result.
        log.withAddedContext(documentId).event.foundDead();
      }
    }

    // Nothing in the cache (except, perhaps, a dead weak reference).
    // Asynchronously construct the ultimate result, returning a promise to it.

    const resultPromise = (async () => {
      try {
        const startTime = Date.now();

        // This validates the document ID and lets us find out the corresponding
        // file ID.
        const docInfo = await Storage.dataStore.getDocumentInfo(documentId);
        const fileId  = docInfo.fileId;

        const file   = await Storage.fileStore.getFile(fileId);
        const result = new FileComplex(this._codec, documentId, file);

        result.log.event.makingComplex(...((fileId === documentId) ? [] : [fileId]));

        await result.init();

        const resultRef = weak(result, this._complexReaper(documentId));

        // Replace the promise in the cache with a weak reference to the actaul
        // result.
        this._complexes.set(documentId, resultRef);

        const endTime = Date.now();
        result.log.event.madeComplex(...((fileId === documentId) ? [] : [fileId]));
        result.log.metric.initTimeMsec(endTime - startTime);

        return result;
      } catch (e) {
        log.error(`Trouble constructing complex ${documentId}.`, e);

        // Remove the promise in the cache, so that we will try again instead of
        // continuing to report this error.
        this._complexes.delete(documentId);

        throw e; // Becomes the rejection value of the promise.
      }
    })();

    // Store the the promise for the result in the cache, and return it.

    log.withAddedContext(documentId).event.aboutToMake();
    this._complexes.set(documentId, resultPromise);
    return resultPromise;
  }

  /**
   * Returns a weak reference callback function for the indicated document ID.
   *
   * @param {string} documentId Document ID of the file complex to remove.
   * @returns {function} An appropriately-constructed function.
   */
  _complexReaper(documentId) {
    // **Note:** This function _used to_ remove the document binding from the
    // `_complexes` map on the presumption that it was a known-dead weak
    // reference. That code has been deleted. First of all, the only benefit
    // would have been that it meant that the weak reference itself could get
    // GC'ed (and a dead weakref doesn't actually take up significant storage).
    // Second, and more importantly, this could fail due to a race condition: If
    // the same document was requested _after_ the old one was GC'ed and
    // _before_ this reaper was called, the cleanup code here would have
    // incorrectly removed a perfectly valid binding.
    return () => {
      log.event.reaped(documentId);
    };
  }
}
