// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import {
  Caret, CaretChange, CaretDelta, CaretOp, CaretSnapshot, RevisionNumber, Timestamp
} from 'doc-common';
import { Condition } from 'promise-util';
import { TInt, TString } from 'typecheck';
import { Errors, InfoError } from 'util-common';

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
 *
 * There is only ever exactly one instance of this class per document, no matter
 * how many active editors there are on that document. (This guarantee is
 * provided by virtue of the fact that `DocServer` only ever creates one
 * `FileComplex` per document, and each `FileComplex` instance only ever makes
 * one instance of this class.
 */
export default class CaretControl extends BaseControl {
  /**
   * Constructs an instance.
   *
   * @param {FileComplex} fileComplex File complex that this instance is part
   *   of.
   */
  constructor(fileComplex) {
    super(fileComplex);

    /**
     * {CaretStorage} File storage handler. This is responsible for all of the
     * file reading and writing.
     */
    this._caretStorage = new CaretStorage(fileComplex);

    /**
     * {CaretSnapshot} Latest caret info. Starts out as an empty stub; gets
     * filled in as updates arrive.
     */
    this._snapshot = CaretSnapshot.EMPTY;

    /**
     * {array<CaretSnapshot>} Array of older caret snapshots, available for use
     * for `getChangeAfter()`.
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
    return new CaretChange(snapshot.revNum + 1, [CaretOp.op_beginSession(caret)]);
  }

  /**
   * Gets a change of caret information from the indicated base caret revision.
   * This will throw an error if the indicated caret revision isn't available.
   *
   * @param {Int} baseRevNum Revision number for the caret information which
   *   will form the basis for the result. If `baseRevNum` is the current
   *   revision number, this method will block until a new revision is
   *   available.
   * @returns {CaretChange} Change from the base caret revision to a newer one.
   */
  async getChangeAfter(baseRevNum) {
    const oldSnapshot = await this.getSnapshot(baseRevNum);

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
   * Gets a snapshot of all active session caret information. This will throw an
   * error if the indicated caret revision isn't available.
   *
   * @param {Int|null} [revNum = null] Which caret revision to get. If passed as
   *   `null`, indicates the latest (most recent) revision.
   * @returns {CaretSnapshot} Snapshot of all the active carets.
   * @throws {InfoError} Error of the form `revision_not_available(revNum)` if
   *   the indicated caret revision isn't available.
   */
  async getSnapshot(revNum = null) {
    this._removeInactiveSessions();
    this._integrateRemoteSessions();

    const minRevNum     = this._oldSnapshots[0].revNum;
    const currentRevNum = this._snapshot.revNum;

    if (revNum === null) {
      revNum = currentRevNum;
    } else if ((revNum < minRevNum) || (revNum > currentRevNum)) {
      throw new InfoError('revision_not_available', revNum);
    }

    return this._oldSnapshots[revNum - minRevNum];
  }

  /**
   * Takes a change consisting of one or more caret updates, and applies it to
   * this instance, producing an updated snapshot.
   *
   * **Note:** This method trusts the contents of the change (e.g., that
   * information about a particular session really did come from that session),
   * and as such it is _not_ appropriate to expose this method directly to
   * client access.
   *
   * @param {CaretChange} change Change to apply.
   * @returns {CaretChange} The correction to the implied expected result of
   *   this operation. The `delta` of this result can be applied to the expected
   *   result to get the actual result. The `timestamp` and `authorId` of the
   *   result will always be `null`. The promise resolves sometime after the
   *   change has been applied to the caret state.
   */
  async update(change) {
    CaretChange.check(change);

    const baseSnapshot    = await this.getSnapshot(change.revNum - 1);
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

    const expectedResult = baseSnapshot.compose(change);
    return baseSnapshot.diff(expectedResult);
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
