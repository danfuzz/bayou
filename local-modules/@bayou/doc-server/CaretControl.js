// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Caret, CaretChange, CaretId, CaretOp, CaretSnapshot } from '@bayou/doc-common';
import { RevisionNumber, Timestamp } from '@bayou/ot-common';
import { TInt, TString } from '@bayou/typecheck';

import CaretColor from './CaretColor';
import EphemeralControl from './EphemeralControl';
import Paths from './Paths';
import SnapshotManager from './SnapshotManager';

/**
 * {Int} How long (in msec) that a caret must be inactive before it gets culled
 * from the current caret snapshot.
 */
const MAX_CARET_IDLE_MSEC = 5 * 60 * 1000; // Five minutes.

/**
 * Controller for the caret metadata of a particular document.
 *
 * **TODO:** Caret data should be ephemeral. As of this writing, old data will
 * never get purged from the underlying file.
 */
export default class CaretControl extends EphemeralControl {
  /**
   * Constructs an instance.
   *
   * @param {FileAccess} fileAccess Low-level file access and related
   *   miscellanea.
   */
  constructor(fileAccess) {
    super(fileAccess, 'caret');

    /** {SnapshotManager} Snapshot manager. */
    this._snapshots = new SnapshotManager(this);

    /**
     * {Int} When to next run {@link #_removeIdleCarets}. Initialized to `0`
     * so that the first check will happen soon after the document is loaded.
     */
    this._nextIdleCheck = 0;

    Object.seal(this);
  }

  /**
   * Constructs a {@link CaretChange} instance which introduces a new caret.
   *
   * @param {string} caretId ID of the caret being introduced.
   * @param {string} authorId ID of the author which controls the caret.
   * @returns {CaretChange} A change instance which represents the above
   *   information, along with anything else needed to be properly applied.
   */
  async changeForNewCaret(caretId, authorId) {
    CaretId.check(caretId);
    TString.check(authorId);

    // Construct the new/updated caret.

    const snapshot   = await this.getSnapshot();
    const lastActive = Timestamp.now();
    const color      = CaretControl._pickCaretColor(caretId, snapshot);
    const caret      = new Caret(caretId, { authorId, color, lastActive });

    return new CaretChange(
      snapshot.revNum + 1,
      [CaretOp.op_add(caret)],
      lastActive);
  }

  /**
   * Constructs a `CaretChange` instance which updates a presumed-preexisting
   * caret, as indicated by the given individual arguments, along with
   * additional information as needed.
   *
   * @param {string} caretId ID of the caret to update.
   * @param {Int} docRevNum The _document_ revision number that this information
   *   is with respect to.
   * @param {Int} index Caret position (if no selection per se) or starting
   *   caret position of the selection.
   * @param {Int} [length = 0] If non-zero, length of the selection.
   * @returns {CaretChange} A change instance which represents the above
   *   information, along with anything else needed to be properly applied.
   */
  async changeForUpdate(caretId, docRevNum, index, length = 0) {
    CaretId.check(caretId);
    RevisionNumber.check(docRevNum);
    TInt.nonNegative(index);
    TInt.nonNegative(length);

    // Construct the updated caret.

    const snapshot   = await this.getSnapshot();
    const oldCaret   = snapshot.get(caretId);
    const lastActive = Timestamp.now();
    const caret      = new Caret(oldCaret, { revNum: docRevNum, lastActive, index, length });

    // We always make a delta with an `add` op. Even though this change isn't
    // always actually adding a caret, when ultimately applied via `update()` it
    // will always turn into an appropriate new snapshot.
    return new CaretChange(
      snapshot.revNum + 1, [CaretOp.op_add(caret)], lastActive);
  }

  /**
   * Subclass-specific implementation of `afterInit()`.
   */
  async _impl_afterInit() {
    // Any cached snapshots are no longer valid.
    this._snapshots.clear();
  }

  /**
   * Underlying implementation of `getSnapshot()`, as required by the
   * superclass.
   *
   * @param {Int} revNum Which revision to get. Guaranteed to be a revision
   *   number for the instantaneously-current revision or earlier.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {CaretSnapshot|null} Snapshot of the indicated revision, or
   *   `null` to indicate that the revision is not available.
   */
  async _impl_getSnapshot(revNum, timeoutMsec = null) {
    this._maybeRemoveIdleCarets();

    return this._snapshots.getSnapshot(revNum, timeoutMsec);
  }

  /**
   * Rebases a given change, such that it can be appended as the revision after
   * the indicated instantaneously-current snapshot.
   *
   * @param {CaretChange} change The change to apply, same as for
   *   {@link #update}, except additionally guaranteed to have a non-empty
   *  `delta`.
   * @param {CaretSnapshot} baseSnapshot Snapshot of the base from which the
   *   change is defined. That is, this is the snapshot of `change.revNum - 1`.
   * @param {CaretSnapshot} expectedSnapshot The implied expected result as
   *   defined by {@link #update}.
   * @param {CaretSnapshot} currentSnapshot An instantaneously-current snapshot.
   *   Guaranteed to be a different revision than `baseSnapshot`.
   * @returns {CaretChange} Rebased (transformed) change, which is suitable for
   *   appending as revision `currentSnapshot.revNum + 1`.
   */
  async _impl_rebase(change, baseSnapshot, expectedSnapshot, currentSnapshot) {
    // The client has requested an application of a delta against a revision of
    // the document which is _not_ current. Though nontrivial, this is
    // considerably simpler than the equivalent document-body update operation,
    // because of the nature of the data being managed (that is, a two-level
    // key-value map, whose leaves are treated as atomic units).
    //
    // What we do is simply compose all of the revisions after the base on top
    // of the expected result to get the final result. We diff from the final
    // result to get the actual change to append.

    this.log.event.rebasingCaret(change.revNum, baseSnapshot.revNum, expectedSnapshot.revNum, currentSnapshot.revNum);

    const finalContents = await this.getComposedChanges(
      expectedSnapshot.contents, baseSnapshot.revNum + 1, currentSnapshot.revNum + 1, true);
    const finalSnapshot = new CaretSnapshot(currentSnapshot.revNum + 1, finalContents);
    const finalChange = currentSnapshot.diff(finalSnapshot)
      .withTimestamp(change.timestamp)
      .withAuthorId(change.authorId);

    this.log.event.rebasedCaret(finalChange.revNum);

    return finalChange;
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {CaretChange} change_unused Change to apply.
   * @param {CaretSnapshot} baseSnapshot_unused The base snapshot the change is
   *   being applied to.
   * @throws {Error} Thrown if `change` is not valid as a change to
   *   `baseSnapshot`.
   */
  _impl_validateChange(change_unused, baseSnapshot_unused) {
    // **TODO:** Implement this!
  }

  /**
   * Perform idle caret cleanup, but only if it's been long enough since the
   * last time that was done. If in fact cleanup is performed, it happens
   * _asynchronously_ with respect to the call to this method.
   */
  _maybeRemoveIdleCarets() {
    const now = Date.now();

    if (now >= this._nextIdleCheck) {
      // Check four times per max-idle period. We update {@link #_nextIdleCheck}
      // here (and not in the subsequent call), so that multiple checks can't
      // "sneak past the gate" as it were, between the time that we decide to
      // run the idle check and the would-be later time that the `async`
      // {@link #_removeIdleCarets} method actually starts running.
      this._nextIdleCheck = now + (MAX_CARET_IDLE_MSEC / 4);
      this._removeIdleCarets();
    }
  }

  /**
   * Removes carets out of the snapshot that haven't been active recently.
   */
  async _removeIdleCarets() {
    this.log.event.idleCheck();

    const snapshot = await this.getSnapshot();

    // **Note:** We have to wait for the `snapshot` to be ready before getting
    // the current time. (That is, the following line cannot be moved above the
    // previous line.) Otherwise, we might produce a change with an out-of-order
    // timestamp.
    const now          = Timestamp.now();
    const minTime      = now.addMsec(-MAX_CARET_IDLE_MSEC);
    let   newSnapshot  = snapshot;
    let   removedCount = 0;

    for (const [caretId, caret] of snapshot.entries()) {
      if (minTime.compareTo(caret.lastActive) > 0) {
        // Too old!
        this.log.withAddedContext(caretId).event.becameIdle();
        newSnapshot = newSnapshot.withoutCaret(caretId);
        removedCount++;
      }
    }

    if (removedCount === 0) {
      this.log.event.nothingIdle();
      return;
    }

    newSnapshot = newSnapshot.withRevNum(snapshot.revNum + 1);

    const change = snapshot.diff(newSnapshot).withTimestamp(now);

    try {
      await this.update(change);
    } catch (e) {
      // Probably a timeout after losing too many races. Though it's
      // log-worthy, it's not a showstopper. The carets will ultimately get
      // cleaned up by another run of the idle timeout (either on this machine
      // or some other one).
      this.log.warn('Error while removing idle carets.', e);
    }

    this.log.event.removedIdle(removedCount);
  }

  /**
   * {string} `StoragePath` prefix string to use for file storage for the
   * portion of the document controlled by instances of this class.
   */
  static get _impl_pathPrefix() {
    return Paths.CARET_PREFIX;
  }

  /**
   * {class} Class (constructor function) of snapshot objects to be used with
   * instances of this class.
   */
  static get _impl_snapshotClass() {
    return CaretSnapshot;
  }

  /**
   * Picks a color to use for a new caret.
   *
   * @param {string} caretId The ID for the new caret (used as a pseudo-random
   *   seed).
   * @param {CaretSnapshot} snapshot Snapshot upon which to base the decision.
   * @returns {string} The color to use, in CSS hex form.
   */
  static _pickCaretColor(caretId, snapshot) {
    // Extract all the currently-used caret colors.
    const usedColors = [];
    for (const [caretId_unused, caret] of snapshot.entries()) {
      usedColors.push(caret.color);
    }

    return CaretColor.colorForCaret(caretId, usedColors);
  }
}
