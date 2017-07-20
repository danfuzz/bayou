// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from 'api-common';
import { BaseFile } from 'content-store';
import { Logger } from 'see-all';
import { ProductInfo } from 'server-env';
import { TString } from 'typecheck';
import { CommonBase } from 'util-common';

import DocControl from './DocControl';

/** {Logger} Logger to use for this module. */
const log = new Logger('doc');

/**
 * Manager for the "complex" of objects which in aggregate allow access and
 * update to a file, for the purpose of managing it as an actively-edited
 * document.
 */
export default class FileComplex extends CommonBase {
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

    /** {string} The document format version to use and expect. */
    this._formatVersion = TString.nonempty(ProductInfo.theOne.INFO.version);

    /**
     * {DocControl|null} Document controller. Set to non-`null` in the
     * corresponding getter.
     */
    this._docControl = null;
  }

  /** {DocControl} The document controller to use with this instance. */
  get docControl() {
    if (this._docControl === null) {
      this._docControl = new DocControl(this.codec, this.file, this.formatVersion);
    }

    return this._docControl;
  }

  /** {Codec} Codec instance to use with the underlying file. */
  get codec() {
    return this._codec;
  }

  /** {BaseFile} The underlying document storage. */
  get file() {
    return this._file;
  }

  /**
   * {Logger} Logger to use with this instance. It prefixes logged items with
   * the file's ID.
   */
  get log() {
    return this._log;
  }

  /**
   * {string} The document format version to use for new documents and to expect
   * in existing documents.
   */
  get formatVersion() {
    return this._formatVersion;
  }
}
