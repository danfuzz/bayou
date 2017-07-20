// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CaretDelta, CaretSnapshot, RevisionNumber } from 'doc-common';
import { TInt, TString } from 'typecheck';
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

  /**
   * Gets a delta of caret information from the indicated base caret revision.
   * This will throw an error if the indicated revision doesn't have caret
   * information available.
   *
   * @param {Int} baseRevNum Revision number for the caret information which
   *   will form the basis for the result. If `baseRevNum` is the current
   *   revision number, this method will block until a new revision is
   *   available.
   * @returns {CaretDelta} Delta from the base caret revision to a newer one.
   */
  async deltaAfter(baseRevNum) {
    // **TODO:** Something more interesting.
    const docRevNum = 0;
    return new CaretDelta(baseRevNum, baseRevNum + 1, docRevNum, []);
  }

  /**
   * Gets a snapshot of all active session caret information. This will throw
   * an error if the indicated caret revision doesn't have caret information
   * available.
   *
   * @param {Int|null} [revNum = null] Which caret revision to get. If passed as
   *   `null`, indicates the latest (most recent) revision.
   * @returns {CaretSnapshot} Snapshot of all the active carets.
   */
  async snapshot(revNum = null) {
    // **TODO:** Something more interesting.
    if (revNum === null) {
      revNum = 0;
    }
    const docRevNum = 0;
    return new CaretSnapshot(revNum, docRevNum, []);
  }

  /**
   * Informs the system of a particular session's current caret or text
   * selection extent. The `index` and `length` arguments to this method have
   * the same semantics as they have in Quill, that is, they ultimately refer to
   * an extent within a Quill `Delta`.
   *
   * @param {string} sessionId ID of the session from which this information
   *   comes.
   * @param {Int} docRevNum The _document_ revision number that this information
   *   is with respect to.
   * @param {Int} index Caret position (if no selection per se) or starting
   *   caret position of the selection.
   * @param {Int} [length = 0] If non-zero, length of the selection.
   * @returns {Int} The _caret_ revision number at which this information was
   *   integrated.
   */
  async update(sessionId, docRevNum, index, length = 0) {
    TString.check(sessionId);
    RevisionNumber.check(docRevNum);
    TInt.min(index, 0);
    TInt.min(length, 0);

    // **TODO:** Something interesting should go here.
    const caretStr = (length === 0)
      ? `@${index}`
      : `[${index}..${index + length - 1}]`;
    this._log.info(`[${sessionId}] Caret update: r${docRevNum}, ${caretStr}`);

    return 0;
  }
}
