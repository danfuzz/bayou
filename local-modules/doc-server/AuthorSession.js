// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CaretDelta, CaretSnapshot, RevisionNumber } from 'doc-common';
import { Logger } from 'see-all';
import { TInt, TString } from 'typecheck';

import DocControl from './DocControl';

/** {Logger} Logger to use for this module. */
const log = new Logger('author-session');

/**
 * Server side representative for a session for a specific author and document.
 * Instances of this class are exposed across the API boundary, and as such
 * all public methods are available for client use.
 *
 * For document access methods, this passes non-mutating methods through to the
 * underlying `DocControl` while implicitly adding an author argument to methods
 * that modify the document.
 */
export default class AuthorSession {
  /**
   * Constructs an instance.
   *
   * @param {string} sessionId Session ID for this instance, which is expected
   *   to be guaranteed unique by whatever service it is that generates it.
   * @param {DocControl} doc The underlying document controller.
   * @param {string} authorId The author this instance acts on behalf of.
   */
  constructor(sessionId, doc, authorId) {
    /** {string} Author ID. */
    this._sessionId = TString.nonempty(sessionId);

    /** {DocControl} The underlying document controller. */
    this._doc = DocControl.check(doc);

    /** {string} Author ID. */
    this._authorId = TString.nonempty(authorId);

    /** {Logger} Logger for this session. */
    this._log = log.withPrefix(`[${sessionId}]`);
  }

  /**
   * Applies a delta, assigning authorship of the change to the author
   * represented by this instance. See the equivalent `DocControl` method for
   * details.
   *
   * @param {number} baseRevNum Revision number which `delta` is with respect
   *   to.
   * @param {FrozenDelta} delta Delta indicating what has changed with respect
   *   to `baseRevNum`.
   * @returns {Promise<DocumentDelta>} Promise for the correction from the
   *   implied expected result to get the actual result.
   */
  applyDelta(baseRevNum, delta) {
    return this._doc.applyDelta(baseRevNum, delta, this._authorId);
  }

  /**
   * Returns a particular change to the document. See the equivalent
   * `DocControl` method for details.
   *
   * @param {Int} revNum The revision number of the change.
   * @returns {Promise<DocumentChange>} Promise for the requested change.
   */
  change(revNum) {
    return this._doc.change(revNum);
  }

  /**
   * Returns a promise for a snapshot of any revision after the given
   * `baseRevNum`. See the equivalent `DocControl` method for details.
   *
   * @param {Int} baseRevNum Revision number for the document.
   * @returns {Promise<DocumentDelta>} Promise for a delta and associated
   *   revision number. The result's `delta` can be applied to revision
   *   `baseRevNum` to produce revision `revNum` of the document.
   */
  deltaAfter(baseRevNum) {
    return this._doc.deltaAfter(baseRevNum);
  }

  /**
   * Returns a bit of identifying info about this instance, for the purposes of
   * logging. Specifically, the client side will call this method and log the
   * results during session initiation.
   *
   * @returns {string} A succinct identification string.
   */
  getLogInfo() {
    return `session ${this._sessionId}; doc ${this._doc.id}; author ${this._authorId}`;
  }

  /**
   * Returns the session ID of this instance.
   *
   * @returns {string} The session ID.
   */
  getSessionId() {
    return this._sessionId;
  }

  /**
   * Returns a snapshot of the full document contents. See the equivalent
   * `DocControl` method for details.
   *
   * @param {Int|null} [revNum = null] Which revision to get. If passed as
   *   `null`, indicates the latest (most recent) revision.
   * @returns {Promise<DocumentSnapshot>} Promise for the requested snapshot.
   */
  snapshot(revNum = null) {
    return this._doc.snapshot(revNum);
  }

  /**
   * Gets a delta of caret information from the indicated base caret revision.
   * This will throw an error if the indicated revision doesn't have caret
   * information available, in which case the client will likely want to use
   * `caretSnapshot()` to get back in synch.
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
   * @returns {Promise<CaretDelta>} Promise for a delta from the base caret
   *   revision to a newer one. Applying this result to a `CaretSnapshot` for
   *   `baseRevNum` will produce an up-to-date snapshot.
   */
  caretDeltaAfter(baseRevNum) {
    // TODO: Something more interesting.
    const docRevNum = 0;
    return new CaretDelta(baseRevNum, baseRevNum + 1, docRevNum, []);
  }

  /**
   * Gets a snapshot of all active session caret information. This will throw
   * an error if the indicated caret revision doesn't have caret information
   * available.
   *
   * **Note:** Caret information is only maintained ephemerally, so it is
   * common for it not to be available for other than just a few recent
   * revisions.
   *
   * @param {Int|null} [revNum = null] Which caret revision to get. If passed as
   *   `null`, indicates the latest (most recent) revision.
   * @returns {CaretSnapshot} Snapshot of all the active carets.
   */
  caretSnapshot(revNum = null) {
    // TODO: Something more interesting.
    if (revNum === null) {
      revNum = 0;
    }
    const docRevNum = 0;
    return new CaretSnapshot(revNum, docRevNum, []);
  }

  /**
   * Informs the system of the client's current caret or text selection extent.
   * This should be called by clients when they notice user activity that
   * changes the selection. More specifically, Quill's `SELECTION_CHANGED`
   * events are expected to drive calls to this method. The `index` and `length
   * arguments to this method have the same semantics as they have in Quill,
   * that is, they ultimately refer to an extent within a Quill `Delta`.
   *
   * @param {Int} docRevNum The _document_ revision number that this information
   *   is with respect to.
   * @param {Int} index Caret position (if no selection per se) or starting
   *   caret position of the selection.
   * @param {Int} [length = 0] If non-zero, length of the selection.
   */
  caretUpdate(docRevNum, index, length = 0) {
    RevisionNumber.check(docRevNum);
    TInt.min(index, 0);
    TInt.min(length, 0);

    // **TODO:** Something interesting should go here.
    const caretStr = (length === 0)
      ? `@${index}`
      : `[${index}..${index + length - 1}]`;
    this._log.info(`Caret update: r${docRevNum}, ${caretStr}`);
  }
}
