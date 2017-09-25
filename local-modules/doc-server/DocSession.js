// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';

import FileComplex from './FileComplex';

/**
 * Server side representative for a session for a specific author and document.
 * Instances of this class are exposed across the API boundary, and as such
 * all public methods are available for client use.
 *
 * For document access methods, this passes non-mutating methods through to the
 * underlying `BodyControl` while implicitly adding an author argument to
 * methods that modify the document.
 */
export default class DocSession {
  /**
   * Constructs an instance.
   *
   * @param {fileComplex} fileComplex File complex representing the underlying
   *   file for this instance to use.
   * @param {string} sessionId Session ID for this instance, which is expected
   *   to be guaranteed unique by whatever service it is that generates it.
   * @param {string} authorId The author this instance acts on behalf of.
   */
  constructor(fileComplex, sessionId, authorId) {
    /** {FileComplex} File complex that this instance is part of. */
    this._fileComplex = FileComplex.check(fileComplex);

    /** {string} Author ID. */
    this._sessionId = TString.nonEmpty(sessionId);

    /** {string} Author ID. */
    this._authorId = TString.nonEmpty(authorId);

    /** {BodyControl} The underlying body content controller. */
    this._bodyControl = fileComplex.bodyControl;

    /** {CaretControl} The underlying caret info controller. */
    this._caretControl = fileComplex.caretControl;

    /** {Logger} Logger for this session. */
    this._log = fileComplex.log.withPrefix(`[${sessionId}]`);
  }

  /**
   * Applies a delta, assigning authorship of the change to the author
   * represented by this instance. See the equivalent `BodyControl` method for
   * details.
   *
   * @param {number} baseRevNum Revision number which `delta` is with respect
   *   to.
   * @param {BodyOpList} ops List of operations indicating what has changed with
   *   respect to `baseRevNum`.
   * @returns {BodyDelta} The correction from the implied expected result to
   *   get the actual result.
   */
  async body_applyDelta(baseRevNum, ops) {
    return this._bodyControl.applyDelta(baseRevNum, ops, this._authorId);
  }

  /**
   * Returns a particular change to the document. See the equivalent
   * `BodyControl` method for details.
   *
   * @param {Int} revNum The revision number of the change.
   * @returns {BodyChange} The requested change.
   */
  async body_change(revNum) {
    return this._bodyControl.change(revNum);
  }

  /**
   * Returns a promise for a snapshot of any revision after the given
   * `baseRevNum`. See the equivalent `BodyControl` method for details.
   *
   * @param {Int} baseRevNum Revision number for the document.
   * @returns {BodyDelta} Delta and associated revision number. The result's
   *   `delta` can be applied to revision `baseRevNum` to produce revision
   *   `revNum` of the document.
   */
  async body_deltaAfter(baseRevNum) {
    return this._bodyControl.deltaAfter(baseRevNum);
  }

  /**
   * Returns a snapshot of the full document contents. See the equivalent
   * `BodyControl` method for details.
   *
   * @param {Int|null} [revNum = null] Which revision to get. If passed as
   *   `null`, indicates the latest (most recent) revision.
   * @returns {BodySnapshot} The requested snapshot.
   */
  async body_snapshot(revNum = null) {
    return this._bodyControl.snapshot(revNum);
  }

  /**
   * Gets a delta of caret information from the indicated base caret revision.
   * This will throw an error if the indicated caret revision isn't available,
   * in which case the client will likely want to use `caret_snapshot()` to get
   * back in synch.
   *
   * **Note:** Caret information and the main document have _separate_ revision
   * numbers. `CaretSnapshot` instances have information about both revision
   * numbers.
   *
   * **Note:** Caret information is only maintained ephemerally, so it is
   * common for it not to be available for other than just a few recent
   * revisions.
   *
   * @param {Int} baseRevNum Revision number for the caret information which
   *   will form the basis for the result. If `baseRevNum` is the current
   *   revision number, this method will block until a new revision is
   *   available.
   * @returns {CaretDelta} Delta from the base caret revision to a newer one.
   *   Applying this result to a `CaretSnapshot` for `baseRevNum` will produce
   *  an up-to-date snapshot.
   */
  async caret_deltaAfter(baseRevNum) {
    return this._caretControl.deltaAfter(baseRevNum);
  }

  /**
   * Gets a snapshot of all active session caret information. This will throw an
   * error if the indicated caret revision isn't available.
   *
   * **Note:** Caret information is only maintained ephemerally, so it is
   * common for it not to be available for other than just a few recent
   * revisions.
   *
   * @param {Int|null} [revNum = null] Which caret revision to get. If passed as
   *   `null`, indicates the latest (most recent) revision.
   * @returns {CaretSnapshot} Snapshot of all the active carets.
   */
  async caret_snapshot(revNum = null) {
    return this._caretControl.snapshot(revNum);
  }

  /**
   * Informs the system of the client's current caret or text selection extent.
   * This should be called by clients when they notice user activity that
   * changes the selection. More specifically, Quill's `SELECTION_CHANGED`
   * events are expected to drive calls to this method. The `index` and `length`
   * arguments to this method have the same semantics as they have in Quill,
   * that is, they ultimately refer to an extent within a Quill `Delta`.
   *
   * @param {Int} docRevNum The _document_ revision number that this information
   *   is with respect to.
   * @param {Int} index Caret position (if no selection per se) or starting
   *   caret position of the selection.
   * @param {Int} [length = 0] If non-zero, length of the selection.
   * @returns {Int} The _caret_ revision number at which this information was
   *   integrated.
   */
  async caret_update(docRevNum, index, length = 0) {
    return this._caretControl.update(this._sessionId, docRevNum, index, length);
  }

  /**
   * Returns a bit of identifying info about this instance, for the purposes of
   * logging. Specifically, the client side will call this method and log the
   * results during session initiation.
   *
   * @returns {string} A succinct identification string.
   */
  getLogInfo() {
    const file    = this._fileComplex.file.id;
    const session = this._sessionId;
    const author  = this._authorId;

    return `file ${file}; session ${session}; author ${author}`;
  }

  /**
   * Returns the session ID of this instance.
   *
   * @returns {string} The session ID.
   */
  getSessionId() {
    return this._sessionId;
  }
}
