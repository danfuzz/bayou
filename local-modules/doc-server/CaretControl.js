// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import {
  Caret, CaretChange, CaretDelta, CaretOp, CaretSnapshot, RevisionNumber, Timestamp
} from 'doc-common';
import { Condition } from 'promise-util';
import { TInt, TString } from 'typecheck';
import { Errors } from 'util-common';

import BaseControl from './BaseControl';
import CaretColor from './CaretColor';
import CaretStorage from './CaretStorage';

/**
 * {Int} How many older caret snapshots should be maintained for potential use
 * as the base for `getChangeAfter()`.
 */
const MAX_OLD_SNAPSHOTS = 20;

/**
 * {Int} How long (in msec) that a session must be inactive before it gets
 * culled from the current caret snapshot.
 */
const MAX_SESSION_IDLE_MSEC = 5 * 60 * 1000; // Five minutes.

/**
 * Controller for the active caret info for a given document.
 */
export default class CaretControl extends BaseControl {
  /**
   * Constructs an instance.
   *
   * @param {FileAccess} fileAccess Low-level file access and related
   *   miscellanea.
   */
  constructor(fileAccess) {
    super(fileAccess);

    /**
     * {CaretStorage} File storage handler. This is responsible for all of the
     * file reading and writing.
     */
    this._caretStorage = new CaretStorage(fileAccess);

    /**
     * {CaretSnapshot} Latest caret info. Starts out as an empty stub; gets
     * filled in as updates arrive.
     */
    this._snapshot = CaretSnapshot.EMPTY;

    /**
     * {array<CaretSnapshot>} Array of older caret snapshots, available for use
     * for `getChangeAfter()` and `getSnapshot()`.
     */
    this._oldSnapshots = [this._snapshot];

    /**
     * {Condition} Condition that gets triggered whenever the snapshot is
     * updated.
     */
    this._updatedCondition = new Condition();

    Object.seal(this);
  }

  /**
   * Constructs a `CaretChange` instance which updates the caret as indicated
   * by the given individual arguments, along with additional information as
   * needed (in particular, a timestamp in all cases and a session color if this
   * update represents the introduction of a new session). The `index` and
   * `length` arguments to this method have the same semantics as they have in
   * Quill, that is, they ultimately refer to an extent within a Quill document
   * `Delta`.
   *
   * @param {string} sessionId ID of the session from which this information
   *   comes.
   * @param {Int} docRevNum The _document_ revision number that this information
   *   is with respect to.
   * @param {Int} index Caret position (if no selection per se) or starting
   *   caret position of the selection.
   * @param {Int} [length = 0] If non-zero, length of the selection.
   * @returns {CaretChange} A change instance which represents the above
   *   information, along with anything else needed to be properly applied.
   */
  changeFor(sessionId, docRevNum, index, length = 0) {
    TString.check(sessionId);
    RevisionNumber.check(docRevNum);
    TInt.nonNegative(index);
    TInt.nonNegative(length);

    // Construct the new/updated caret.

    const snapshot   = this._snapshot;
    const oldCaret   = snapshot.getOrNull(sessionId);
    const lastActive = Timestamp.now();
    const newFields  = { revNum: docRevNum, lastActive, index, length };
    let caret;

    if (oldCaret === null) {
      newFields.color = this._pickSessionColor(sessionId);
      caret = new Caret(sessionId, newFields);
    } else {
      caret = new Caret(oldCaret, newFields);
    }

    // We always make a delta with a "begin session" op. Even though this change
    // isn't always actually beginning a session, when ultimately applied via
    // `update()` it will always turn into an appropriate new snapshot.
    return new CaretChange(
      snapshot.revNum + 1, [CaretOp.op_beginSession(caret)], lastActive);
  }

  /**
   * {class} Class (constructor function) of snapshot objects to be used with
   * instances of this class.
   */
  static get _impl_snapshotClass() {
    return CaretSnapshot;
  }

  /**
   * Underlying implementation of `currentRevNum()`, as required by the
   * superclass.
   *
   * @returns {Int} The instantaneously-current revision number.
   */
  async _impl_currentRevNum() {
    this._removeInactiveSessions();
    this._integrateRemoteSessions();

    return this._snapshot.revNum;
  }

  /**
   * Underlyingimplementation of `getChangeAfter()`, as required by the
   * superclass.
   *
   * @param {Int} baseRevNum Revision number for the base to get a change with
   *   respect to. Guaranteed to refer to the instantaneously-current revision
   *   or earlier.
   * @param {Int} currentRevNum_unused The instantaneously-current revision
   *   number that was determined just before this method was called. It is
   *   unused in this case because the implementation has synchronous knowledge
   *   of the actually-current revision.
   * @returns {CaretChange|null} Change with respect to the revision indicated
   *   by `baseRevNum`, or `null` to indicate that the revision was not
   *   available as a base.
   */
  async _impl_getChangeAfter(baseRevNum, currentRevNum_unused) {
    // This uses the `_impl` snapshot so that we get a `null` instead of a
    // thrown error when the revision isn't available.
    const oldSnapshot = await this._impl_getSnapshot(baseRevNum);

    if (oldSnapshot === null) {
      return null;
    }

    // Iterate if / as long as the base revision is still the current one. This
    // will stop being the case if either there's a local or remote update. The
    // loop is needed because the remote update check can time out without an
    // actual change happening.
    while (oldSnapshot.revNum === this._snapshot.revNum) {
      // Wait for either a local or remote update, whichever comes first.
      await Promise.race([
        this._updatedCondition.whenTrue(),
        this._caretStorage.whenRemoteChange()
      ]);

      // If there were remote changes, this will cause the snapshot to get
      // updated.
      this._integrateRemoteSessions();
    }

    return oldSnapshot.diff(this._snapshot);
  }

  /**
   * Underlying implementation of `getSnapshot()`, as required by the
   * superclass.
   *
   * @param {Int} revNum Which revision to get. Guaranteed to be a revision
   *   number for the instantaneously-current revision or earlier.
   * @returns {CaretSnapshot|null} Snapshot of the indicated revision, or `null`
   *   to indicate that the revision is not available.
   */
  async _impl_getSnapshot(revNum) {
    const minRevNum = this._oldSnapshots[0].revNum;
    const maxRevNum = this._snapshot.revNum;

    if (revNum < minRevNum) {
      return null;
    } else if (revNum > maxRevNum) {
      // Shouldn't happen, because the superclass should have guaranteed that we
      // never get requests for future revisions.
      throw Errors.wtf(`Invalid request for future revision: ${revNum}`);
    }

    return this._oldSnapshots[revNum - minRevNum];
  }

  /**
   * Main implementation of `update()`, as required by the superclass.
   *
   * @param {CaretSnapshot} baseSnapshot Snapshot of the base from which the
   *   change is defined.
   * @param {CaretChange} change The change to apply, same as for `update()`.
   * @param {CaretSnapshot} expectedSnapshot The implied expected result as
   *   defined by `update()`.
   * @returns {CaretChange} Result for the outer call to `update()`. Though the
   *   superclass allows it, this implementation will never return `null`.
   */
  async _impl_update(baseSnapshot, change, expectedSnapshot) {
    const currentSnapshot = this._snapshot;
    const newSnapshot     = currentSnapshot.compose(change);

    // Apply the update, and inform both the storage layer and any waiters.

    for (const op of change.delta.ops) {
      const { opName, sessionId, caret } = op.props;
      switch (opName) {
        case CaretOp.BEGIN_SESSION: {
          this._caretStorage.update(newSnapshot.get(caret.sessionId));
          break;
        }
        case CaretOp.END_SESSION: {
          this._caretStorage.delete(sessionId);
          break;
        }
        case CaretOp.SET_FIELD: {
          this._caretStorage.update(newSnapshot.get(sessionId));
          break;
        }
        default: {
          throw Errors.wtf(`Weird caret operation: ${opName}`);
        }
      }
    }

    this._updateSnapshot(newSnapshot);

    // Figure out and return the "correction" change.

    if (baseSnapshot.revNum === currentSnapshot.revNum) {
      // No intervening changes, so no correction.
      return new CaretChange(change.revNum, CaretDelta.EMPTY);
    }

    return baseSnapshot.diff(expectedSnapshot);
  }

  /**
   * Merges any new remote session info into the snapshot.
   */
  _integrateRemoteSessions() {
    const oldSnapshot = this._snapshot;
    const newSnapshot = this._caretStorage.integrateRemotes(oldSnapshot);

    if (newSnapshot !== oldSnapshot) {
      this._updateSnapshot(newSnapshot);
    }
  }

  /**
   * Picks a color to use for a new session.
   *
   * @param {string} sessionId The ID for the new session (used as a
   *   pseudo-random seed).
   * @returns {string} The color to use, in CSS hex form.
   */
  _pickSessionColor(sessionId) {
    // Integrate remote sessions, if any, as those will have colors we won't
    // have yet observed.
    this._integrateRemoteSessions();

    // Extract all the currently-used caret colors.
    const usedColors = [];
    for (const [sessionId_unused, caret] of this._snapshot.entries()) {
      usedColors.push(caret.color);
    }

    return CaretColor.colorForSession(sessionId, usedColors);
  }

  /**
   * Removes sessions out of the snapshot that haven't been active recently.
   */
  _removeInactiveSessions() {
    const minTime  = Timestamp.now().addMsec(-MAX_SESSION_IDLE_MSEC);
    const toRemove = [];

    for (const [sessionId, caret] of this._snapshot.entries()) {
      if (minTime.compareTo(caret.lastActive) > 0) {
        // Too old!
        this.log.info(`[${sessionId}] Caret became inactive.`);
        toRemove.push(sessionId);
      }
    }

    this._removeSessions(...toRemove);
  }

  /**
   * Removes the indicated sessions from the local snapshot, and also pushes the
   * removal to the storage layer.
   *
   * @param {...string} sessionIds IDs of the sessions to be removed.
   */
  _removeSessions(...sessionIds) {
    const storage     = this._caretStorage;
    const oldSnapshot = this._snapshot;
    let   newSnapshot = oldSnapshot;

    for (const sessionId of sessionIds) {
      newSnapshot = newSnapshot.withoutSession(sessionId);
      storage.delete(sessionId);
    }

    if (newSnapshot !== oldSnapshot) {
      this._updateSnapshot(newSnapshot);
    }
  }

  /**
   * Indicates that a particular session was reaped (GC'ed). This is a "friend"
   * method which gets called by `FileComplex`.
   *
   * @param {string} sessionId ID of the session that got reaped.
   */
  async _sessionReaped(sessionId) {
    if (this._snapshot.has(sessionId)) {
      this._removeSessions(sessionId);
    }
  }

  /**
   * Updates the stored snapshot to the one given, with an incremented
   * caret revision number.
   *
   * @param {CaretSnapshot} snapshot The new snapshot.
   */
  _updateSnapshot(snapshot) {
    const oldSnapshot = this._snapshot;
    const newRevNum   = oldSnapshot.revNum + 1;
    const newSnapshot = snapshot.withRevNum(newRevNum);

    // Update the snapshot instance variable, and wake up any waiters.
    this._snapshot = newSnapshot;
    this._oldSnapshots.push(newSnapshot);
    this._updatedCondition.onOff();

    // Trim `_oldSnapshots` down to its allowed length.
    while (this._oldSnapshots.length > MAX_OLD_SNAPSHOTS) {
      this._oldSnapshots.shift();
    }

    // Log the changes.

    const loggedSessions = new Set();
    for (const op of oldSnapshot.diff(snapshot).delta.ops) {
      const opName = op.props.opName;
      let { sessionId, caret } = op.props;
      switch (opName) {
        case CaretOp.BEGIN_SESSION: {
          sessionId = caret.sessionId;
          break;
        }
        case CaretOp.END_SESSION: {
          caret = null;
          break;
        }
        case CaretOp.SET_FIELD: {
          caret = snapshot.get(sessionId);
          break;
        }
        default: {
          throw Errors.wtf(`Weird caret operation: ${opName}`);
        }
      }

      if (loggedSessions.has(sessionId)) {
        continue;
      }

      if (caret === null) {
        this.log.info(`[${sessionId}] Ended.`);
      } else {
        const { index, length, revNum } = caret;
        const caretStr = (length === 0)
          ? `@${index}`
          : `[${index}..${index + length - 1}]`;
        this.log.info(`[${sessionId}] Update: rev ${revNum}, ${caretStr}`);
      }

      loggedSessions.add(sessionId);
    }

    this.log.info('New caret revision number:', newRevNum);
  }
}
