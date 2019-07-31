// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codecs } from '@bayou/app-common';
import { Storage } from '@bayou/config-server';
import { Logger } from '@bayou/see-all';
import { Singleton } from '@bayou/util-common';

import { DocComplex } from './DocComplex';
import { DocComplexCache } from './DocComplexCache';

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
export class DocServer extends Singleton {
  /**
   * Constructs an instance. This is not meant to be used publicly.
   */
  constructor() {
    super();

    /** {Codec} Codec instance to use. */
    this._codec = Codecs.fullCodec;

    /**
     * {DocComplexCache} Cache of {@link DocComplex} instances, mapped from
     * document IDs.
     */
    this._complexes = new DocComplexCache(log);

    Object.freeze(this);
  }

  /**
   * Gets the `DocComplex` for the document with the given ID. It is okay (not
   * an error) if the underlying file doesn't happen to exist.
   *
   * @param {string} documentId The document ID.
   * @returns {DocComplex} The corresponding `DocComplex`.
   */
  async getDocComplex(documentId) {
    // **Note:** We don't make an `async` back-end call to check the full
    // validity of `documentId` here, because that would be a waste if it turns
    // out we've already cached a valid result. Once we determine that we need
    // to construct a new complex (below), we'll call through to the back-end to
    // get a file ID, and that call implicitly validates the document ID.
    Storage.docStore.checkDocumentIdSyntax(documentId);

    return this._complexes.resolveOrAdd(documentId, async () => {
      try {
        const startTime = Date.now();

        // This validates the document ID and lets us find out the corresponding
        // file ID.
        const docInfo = await Storage.docStore.getDocumentInfo(documentId);
        const fileId  = docInfo.fileId;

        const file   = await Storage.fileStore.getFile(fileId);
        const result = new DocComplex(this._codec, documentId, file);

        result.log.event.makingComplex(...((fileId === documentId) ? [] : [fileId]));

        await result.init();

        const endTime = Date.now();
        result.log.event.madeComplex(...((fileId === documentId) ? [] : [fileId]));
        result.log.metric.initTimeMsec(endTime - startTime);

        return result;
      } catch (e) {
        log.error(`Trouble constructing complex ${documentId}.`, e);
        throw e; // Becomes the rejection value of the promise.
      }
    });
  }

  /**
   * Gets stats about the resource consumption managed by this instance, in the
   * form of an ad-hoc plain object. This information is used as part of the
   * high-level "load factor" metric calculation, as well as logged and
   * exposed on the monitoring port.
   *
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range for {@link BaseFile}. `null` is treated as the maximum allowed
   *   value.
   * @returns {object} Ad-hoc plain object with resource consumption stats.
   */
  async currentResourceConsumption(timeoutMsec = null) {
    let bodyChangeCount = 0;
    let documentCount   = 0;
    let roughSize       = 0;
    let sessionCount    = 0;

    // Helper for the loop below: Process a `DocComplex`.
    async function processDocComplex(complex) {
      const stats = await complex.currentResourceConsumption(timeoutMsec);

      documentCount++;
      bodyChangeCount += stats.bodyChangeCount;
      roughSize       += stats.roughSize;
      sessionCount    += stats.sessionCount;
    }

    for (const value of this._complexes.values()) {
      try {
        if (value.object) {
          await processDocComplex(value.object);
        } else {
          await processDocComplex(await value.promise);
        }
      } catch (e) {
        // Ignore the exception (other than logging): Resource consumption
        // calculation is best-effort only.
        log.event.errorDuringResourceConsumptionCalculation(e);
      }
    }

    return {
      bodyChangeCount,
      documentCount,
      roughSize,
      sessionCount
    };
  }
}
