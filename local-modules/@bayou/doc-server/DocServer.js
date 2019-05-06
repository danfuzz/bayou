// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codecs as appCommon_TheModule } from '@bayou/app-common';
import { Storage } from '@bayou/config-server';
import { Logger } from '@bayou/see-all';
import { Singleton } from '@bayou/util-common';

import { FileComplex } from './FileComplex';
import { FileComplexCache } from './FileComplexCache';

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
    this._codec = appCommon_TheModule.fullCodec;

    /**
     * {FileComplexCache} Cache of {@link FileComplex} instances, mapped from
     * document IDs.
     */
    this._complexes = new FileComplexCache(log);

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
        const result = new FileComplex(this._codec, documentId, file);

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
}
