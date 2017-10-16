// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from 'codec';
import { ProductInfo } from 'env-server';
import { BaseFile, FileCodec } from 'file-store';
import { Logger } from 'see-all';
import { TString } from 'typecheck';
import { CommonBase } from 'util-common';

/** {Logger} Logger to use for this module. */
const log = new Logger('doc');

/**
 * Convenient access for the lower-level bits of a file, along with a single
 * {@link Logger} instance for use with a file complex. This class mainly exists
 * exists so as to make it easier to test {@link BaseControl} and its subclasses
 * in isolation, since otherwise they would all have mutual dependencies via
 * {@link FileComplex}.
 */
export default class FileAccess extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Codec} codec Codec instance to use.
   * @param {BaseFile} file The underlying document storage.
   */
  constructor(codec, file) {
    super();

    /** {Codec} Codec instance to use. */
    this._codec = Codec.check(codec);

    /** {BaseFile} The underlying document storage. */
    this._file = BaseFile.check(file);

    /** {Logger} Logger for this instance. */
    this._log = log.withPrefix(`[${file.id}]`);

    /** {string} The document schema version to use and expect. */
    this._schemaVersion = TString.nonEmpty(ProductInfo.theOne.INFO.version);

    /** {FileCodec} File-codec wrapper to use. */
    this._fileCodec = new FileCodec(file, codec);

    Object.freeze(this);
  }

  /** {Codec} Codec instance to use with the underlying file. */
  get codec() {
    return this._codec;
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
