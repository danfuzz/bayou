// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

import FileComplex from './FileComplex';

/**
 * Controller for the active caret info for a given document.
 *
 * There is only ever exactly one instance of this class per document, no matter
 * how many active editors there are on that document. (This guarantee is
 * provided by virtue of the fact that `DocServer` only ever creates one
 * `FileComplex` per document, and each `FileComplex` instance only ever makes
 * one instance of this class.
 *
 * **TODO:** Fill in this class!
 */
export default class CaretControl extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {FileComplex} fileComplex File complex that this instance is part
   *   of.
   */
  constructor(fileComplex) {
    super();

    /** {FileComplex} File complex that this instance is part of. */
    this._fileComplex = FileComplex.check(fileComplex);

    /** {Logger} Logger specific to this document's ID. */
    this._log = fileComplex.log;
  }
}
