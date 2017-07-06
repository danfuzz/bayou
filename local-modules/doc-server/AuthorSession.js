// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Logger } from 'see-all';
import { TInt, TString } from 'typecheck';

import DocControl from './DocControl';

/** Logger. */
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
   * @returns {Promise<DeltaResult>} Promise for the correction from the
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
   * @returns {Promise<DeltaResult>} Promise for a delta and associated revision
   *   number. The result's `delta` can be applied to revision `baseRevNum` to
   *   produce revision `revNum` of the document.
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
   * @returns {Promise<Snapshot>} Promise for the requested snapshot.
   */
  snapshot(revNum = null) {
    return this._doc.snapshot(revNum);
  }

  /**
   * Informs the system of the client's current caret or text selection extent.
   * This should be called by clients when they notice user activity that
   * changes the selection. More specifically, Quill's `SELECTION_CHANGED`
   * events are expected to drive calls to this method. Arguments to this method
   * have the semantics of offset and length within a Quill `Delta`.
   *
   * @param {Int} index Caret position (if no selection per se) or starting
   *   caret position of the selection.
   * @param {Int} [length = 0] If non-zero, length of the selection.
   */
  updateCaret(index, length = 0) {
    TInt.min(index, 0);
    TInt.min(length, 0);

    // **TODO:** Something interesting should go here.
    log.info(`Got caret update for ${this._sessionId}: ${index}, ${length}`);
  }
}
