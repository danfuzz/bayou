// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

import FileAccess from './FileAccess';

/**
 * Base class for things that hook up to a {@link FileComplex} and for
 * `FileComplex` itself.
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
    return this._fileAccess.log;
  }
}
