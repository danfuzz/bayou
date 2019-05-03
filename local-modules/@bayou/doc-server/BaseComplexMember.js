// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

import { FileAccess } from './FileAccess';

/**
 * Base class for things that hook up to a {@link FileComplex} and for
 * `FileComplex` itself.
 */
export class BaseComplexMember extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {FileAccess} fileAccess Low-level file access and related
   *   miscellanea.
   * @param {string} logLabel Label (prefix) to include with all log messages
   *   coming from this instance.
   */
  constructor(fileAccess, logLabel) {
    super();

    /** {FileAccess} Low-level file access and associated miscellanea. */
    this._fileAccess = FileAccess.check(fileAccess);

    /** {string} Label to use for this instance's log messages. */
    this._logLabel = TString.check(logLabel);

    /** {Logger} Logger to use with this instance. Includes the log label. */
    this._log = fileAccess.log.withAddedContext(logLabel);
  }

  /** {Codec} Codec instance to use with the underlying file. */
  get codec() {
    return this._fileAccess.codec;
  }

  /** {BaseFile} The underlying document storage. */
  get file() {
    return this._fileAccess.file;
  }

  /** {FileAccess} Low-level file access and associated miscellanea. */
  get fileAccess() {
    return this._fileAccess;
  }

  /** {FileCodec} File-codec wrapper to use when dealing with encoded data. */
  get fileCodec() {
    return this._fileAccess.fileCodec;
  }

  /** {Logger} Logger to use with this instance. */
  get log() {
    return this._log;
  }
}
