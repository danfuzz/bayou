// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

/**
 * {class|null} The class `FileClass`, or `null` if it hasn't yet been fetched.
 * This arrangement is done because directly `import`ing it would result in a
 * circular dependency between `FileComplex` and this class, which &mdash; as
 * observed in practice &mdash; leads to a failure to initialize subclasses of
 * this class. Alas!
 */
let FileComplex = null;

/**
 * Base class for things that hook up to a {@link FileComplex}.
 */
export default class BaseComplexMember extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {FileComplex} fileComplex File complex that this instance is part
   *   of.
   */
  constructor(fileComplex) {
    if (FileComplex === null) {
      FileComplex = require('./FileComplex').default;
    }

    super();

    /** {FileComplex} File complex that this instance is part of. */
    this._fileComplex = FileComplex.check(fileComplex);

    /** {BaseFile} The underlying document storage. */
    this._file = fileComplex.file;

    /** {FileCodec} File-codec wrapper to use. */
    this._fileCodec = fileComplex.fileCodec;

    /** {Logger} Logger specific to this document's ID. */
    this._log = fileComplex.log;
  }

  /** {BaseFile} The underlying document storage. */
  get file() {
    return this._file;
  }

  /** {FileCodec} File-codec wrapper to use when dealing with encoded data. */
  get fileCodec() {
    return this._fileCodec;
  }

  /** {FileComplex} File complex that this instance is part of. */
  get fileComplex() {
    return this._fileComplex;
  }

  /** {Logger} Logger to use with this instance. */
  get log() {
    return this._log;
  }
}
