// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

import FileAccess from './FileAccess';

/**
 * Base class for things that hook up to a {@link FileComplex}.
 */
export default class BaseComplexMember extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {FileAccess} fileAccess Low-level file access and related
   *   miscellanea.
   */
  constructor(fileAccess) {
    super();

    /** {FileAccess} Low-level file access and associated miscellanea. */
    this._fileAccess = FileAccess.check(fileAccess);
  }

  /** {Codec} Codec instance to use with the underlying file. */
  get codec() {
    return this._fileAccess.codec;
  }

  /** {BaseFile} The underlying document storage. */
  get file() {
    return this._fileAccess.file;
  }

  /** {FileCodec} File-codec wrapper to use when dealing with encoded data. */
  get fileCodec() {
    return this._fileAccess.fileCodec;
  }

  /** {FileComplex} File complex that this instance is part of. */
  get fileComplex() {
    return this._fileAccess.fileComplex;
  }

  /** {Logger} Logger to use with this instance. */
  get log() {
    return this._fileAccess.log;
  }

  /**
   * {string} The document schema version to use for new documents and to expect
   * in existing documents.
   */
  get schemaVersion() {
    return this._fileAccess.schemaVersion;
  }
}
