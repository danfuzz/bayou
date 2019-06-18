// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from '@bayou/codec';
import { BaseFile, FileCodec } from '@bayou/file-store';
import { BaseLogger, Logger } from '@bayou/see-all';
import { TString } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

/** {Logger} Logger to use for this module. */
const log = new Logger('doc');

/**
 * Convenient access for the lower-level bits of a file, along with a single
 * {@link Logger} instance for use with a file complex. This class mainly exists
 * exists so as to make it easier to test {@link BaseControl} and its subclasses
 * in isolation, since otherwise they would all have mutual dependencies via
 * {@link DocComplex}.
 */
export class FileAccess extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Codec} codec Codec instance to use.
   * @param {string} documentId ID of the document associated with this
   *   instance.
   * @param {BaseFile} file The underlying document storage.
   * @param {BaseLogger} [logger = null] If non-`null`, logger to use instead of
   *   the usual one. This is only meant to be used for unit testing.
   */
  constructor(codec, documentId, file, logger = null) {
    super();

    /** {Codec} Codec instance to use. */
    this._codec = Codec.check(codec);

    /**
     * {string} ID of the document associated with this instance. **Note:** Just
     * verified to be a string, because the actual ID syntax should have been
     * checked at a higher layer.
     */
    this._documentId = TString.check(documentId);

    /** {BaseFile} The underlying document storage. */
    this._file = BaseFile.check(file);

    /** {BaseLogger} Logger for this instance. */
    this._log =
      ((logger === null) ? log : BaseLogger.check(logger)).withAddedContext(file.id);

    /** {FileCodec} File-codec wrapper to use. */
    this._fileCodec = new FileCodec(file, codec);

    Object.freeze(this);
  }

  /** {Codec} Codec instance to use with the underlying file. */
  get codec() {
    return this._codec;
  }

  /** {string} ID of the document associated with this instance. */
  get documentId() {
    return this._documentId;
  }

  /** {BaseFile} The underlying document storage. */
  get file() {
    return this._file;
  }

  /** {FileCodec} File-codec wrapper to use. */
  get fileCodec() {
    return this._fileCodec;
  }

  /**
   * {Logger} Logger to use with this instance. It prefixes logged items with
   * the file's ID.
   */
  get log() {
    return this._log;
  }

  /**
   * {string} The document schema version to use for new documents and to expect
   * in existing documents.
   */
  get schemaVersion() {
    return this._schemaVersion;
  }
}
