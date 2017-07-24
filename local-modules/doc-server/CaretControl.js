// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CaretDelta, CaretOp, CaretSnapshot, RevisionNumber } from 'doc-common';
import { TInt, TString } from 'typecheck';
import { ColorSelector, CommonBase, PromCondition } from 'util-common';

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
 * **TODO:** This class needs to store caret info via the `content-store`,
 * instead of being purely ephemeral. It also needs to know how to remove
 * sessions that go idle for too long.
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

    /**
     * {CaretSnapshot} Latest caret info. Starts out as an empty stub; gets
     * filled in as updates arrive.
     */
    this._snapshot = new CaretSnapshot(0, 0, []);

    /**
     * {PromCondition} Condition that gets triggered whenever the snapshot is
     * updated.
     */
    this._updatedCondition = new PromCondition();

    /** {ColorSelector} Provider of well-distributed colors. */
    this._colorSelector = new ColorSelector();

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
    const oldSnapshot = this._snapshot;

    // For now, we only succeed if the latest revision is being requested.
    // **TODO:** Handle past revisions, details to be driven by client
    // requirements.
    if (baseRevNum !== oldSnapshot.revNum) {
      throw new Error(`Revision not available: ${baseRevNum}`);
    }

    await this._updatedCondition.whenTrue();
    return oldSnapshot.diff(this._snapshot);
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
    // For now, we only succeed if the latest revision is being requested.
    // **TODO:** Handle past revisions, details to be driven by client
    // requirements.
    if ((revNum !== null) && (revNum !== this._snapshot.revNum)) {
      throw new Error(`Revision not available: ${revNum}`);
    }

    return this._snapshot;
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

    const caretStr = (length === 0)
      ? `@${index}`
      : `[${index}..${index + length - 1}]`;
    this._log.info(`[${sessionId}] Caret update: r${docRevNum}, ${caretStr}`);

    // Build up an array of ops to apply to the current snapshot.

    const snapshot = this._snapshot;
    const ops      = [];
    const oldCaret = snapshot.caretForSession(sessionId);
    let color;

    if (oldCaret === null) {
      ops.push(CaretOp.op_beginSession(sessionId));
      color = this._colorSelector.nextColorHex();
    } else {
      color = oldCaret.color;
    }

    ops.push(CaretOp.op_updateAuthorSelection(sessionId, index, length, color));

    // **TODO:** Handle `docRevNum` sensibly instead of just blithely thwacking
    // it into the new snapshot.
    ops.push(CaretOp.op_updateDocRevNum(docRevNum));

    // Apply the ops, and inform any waiters.
    return this._applyOps(ops);
  }

  /**
   * Applies the given operations to the current snapshot, producing a new
   * snapshot with an incremented caret revision number.
   *
   * @param {array<CaretOp>} ops Operations to apply.
   * @returns {Int} The _caret_ revision number at which this information was
   *   integrated.
   */
  _applyOps(ops) {
    const snapshot  = this._snapshot;
    const newRevNum = snapshot.revNum + 1;
    const delta     = new CaretDelta(newRevNum, ops);

    // Update the snapshot, and wake up any waiters.
    this._snapshot = snapshot.compose(delta);
    this._updatedCondition.onOff();

    this._log.detail(`New caret revision number: ${newRevNum}`);

    return newRevNum;
  }

  /**
   * Indicates that a particular session was reaped (GC'ed). This is a "friend"
   * method which gets called by `FileComplex`.
   *
   * @param {string} sessionId ID of the session that got reaped.
   */
  _sessionReaped(sessionId) {
    const snapshot = this.snapshot;
    const oldCaret = snapshot.caretForSession(sessionId);

    if (oldCaret !== null) {
      const ops   = [CaretOp.op_endSession(sessionId)];

      this._log.info(`[${sessionId}] Caret removed.`);
      this._applyOps(ops);
    }
  }
}
