// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Caret, CaretSnapshot, RevisionNumber, Timestamp } from 'doc-common';
import { TInt, TString } from 'typecheck';
import { ColorSelector, CommonBase, PromCondition } from 'util-common';

import CaretStorage from './CaretStorage';

/**
 * {Int} How many older caret snapshots should be maintained for potential use
 * as the base for `deltaAfter()`.
 */
const MAX_OLD_SNAPSHOTS = 20;

/**
 * {Int} How long (in msec) that a session must be inactive before it gets
 * culled from the current caret snapshot.
 */
const MAX_SESSION_IDLE_MSEC = 10 * 60 * 1000; // Ten minutes.

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
     * for `deltaAfter()`.
     */
    this._oldSnapshots = [this._snapshot];

    /**
     * {PromCondition} Condition that gets triggered whenever the snapshot is
     * updated.
     */
    this._updatedCondition = new PromCondition();

    /** {ColorSelector} Provider of well-distributed colors. */
    this._colorSelector = new ColorSelector();

    /** {Logger} Logger specific to this document's ID. */
    this._log = fileComplex.log;

    Object.seal(this);
  }

  /**
   * Gets a delta of caret information from the indicated base caret revision.
   * This will throw an error if the indicated caret revision isn't available.
   *
   * @param {Int} baseRevNum Revision number for the caret information which
   *   will form the basis for the result. If `baseRevNum` is the current
   *   revision number, this method will block until a new revision is
   *   available.
   * @returns {CaretDelta} Delta from the base caret revision to a newer one.
   */
  async deltaAfter(baseRevNum) {
    const oldSnapshot = await this.snapshot(baseRevNum);

    // **Note:** Can only do this after the above `await` returns (because the
    // current snapshot from before the `await` may be out-of-date).
    const currentRevNum = this._snapshot.revNum;

    if (oldSnapshot.revNum === currentRevNum) {
      // We've been asked for a revision newer than the most recent one, so we
      // have to wait for a change to be made. `_snapshot` will have been
      // changed by the time this `await` returns.
      await this._updatedCondition.whenTrue();
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
   */
  async snapshot(revNum = null) {
    this._removeInactiveSessions();
    this._integrateRemoteSessions();

    const minRevNum     = this._oldSnapshots[0].revNum;
    const currentRevNum = this._snapshot.revNum;

    if (revNum === null) {
      revNum = currentRevNum;
    } else if ((revNum < minRevNum) || (revNum > currentRevNum)) {
      throw new Error(`Revision not available: ${revNum}`);
    }

    return this._oldSnapshots[revNum - minRevNum];
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
    TInt.nonNegative(index);
    TInt.nonNegative(length);

    // Construct the new/updated caret and updated snapshot.

    let snapshot     = this._snapshot;
    const oldCaret   = snapshot.caretForSession(sessionId);
    const revNum     = docRevNum; // Done to match the caret field name.
    const lastActive = Timestamp.now();
    const newFields  = { revNum, lastActive, index, length };
    let newCaret;

    if (oldCaret === null) {
      newFields.color = this._colorSelector.nextColorHex();
      newCaret = new Caret(sessionId, Object.entries(newFields));
    } else {
      newCaret = new Caret(oldCaret, Object.entries(newFields));
    }

    snapshot = snapshot.withCaret(newCaret);

    // Apply the update, and inform both the storage layer and any waiters.

    const caretStr = (length === 0)
      ? `@${index}`
      : `[${index}..${index + length - 1}]`;
    this._log.info(`[${sessionId}] Caret update: r${revNum}, ${caretStr}`);

    this._caretStorage.update(newCaret);

    return this._updateSnapshot(snapshot);
  }

  /**
   * Merges any new remote session info into the snapshot.
   */
  _integrateRemoteSessions() {
    const snapshot = this._snapshot;
    const remotes = this._caretStorage.remoteSnapshot();

    let newSnapshot = snapshot;
    for (const c of remotes.carets) {
      newSnapshot = newSnapshot.withCaret(c);
    }

    if (newSnapshot !== snapshot) {
      this._updateSnapshot(newSnapshot);
    }
  }

  /**
   * Removes sessions out of the snapshot that haven't been active recently.
   */
  _removeInactiveSessions() {
    const minTime = Timestamp.now().addMsec(-MAX_SESSION_IDLE_MSEC);

    for (const c of this._snapshot.carets) {
      if (minTime.compareTo(c.lastActive) > 0) {
        // Too old!
        this._log.info(`[${c.sessionId}] Caret became inactive.`);
        this._removeSession(c);
      }
    }
  }

  /**
   * Removes the indicated caret from the local snapshot, and also pushes the
   * removal to the storage layer.
   *
   * @param {Caret} caret Caret representing the session to be removed.
   */
  _removeSession(caret) {
    Caret.check(caret);

    const snapshot = this._snapshot.withoutCaret(caret);
    this._updateSnapshot(snapshot);
    this._caretStorage.delete(caret);
  }

  /**
   * Indicates that a particular session was reaped (GC'ed). This is a "friend"
   * method which gets called by `FileComplex`.
   *
   * @param {string} sessionId ID of the session that got reaped.
   */
  async _sessionReaped(sessionId) {
    const snapshot = this._snapshot;

    // **TODO:** These conditionals check for a weird case that has shown up
    // intermittently, namely that `_snapshot` doesn't have a `caretForSession`
    // method. It is unclear what's going on as of this writing, and the hope is
    // that this check and message may help sort things out.
    if (!snapshot) {
      this._log.wtf('Snapshot not set? Currently:', snapshot);
    } else if (!snapshot.caretForSession) {
      this._log.wtf('`caretForSession` not defined? Snapshot:', snapshot);
    }

    const oldCaret = snapshot.caretForSession(sessionId);

    if (oldCaret !== null) {
      this._removeSession(oldCaret);
    }
  }

  /**
   * Updates the stored snapshot to the one given, with an incremented
   * caret revision number.
   *
   * @param {CaretSnapshot} snapshot The new snapshot.
   * @returns {Int} The new caret revision number.
   */
  _updateSnapshot(snapshot) {
    const oldSnapshot = this._snapshot;
    const newRevNum   = oldSnapshot.revNum + 1;
    const newSnapshot = snapshot.withRevNum(newRevNum);

    // Update the snapshot instance variable, and wake up any waiters.
    this._snapshot = newSnapshot;
    this._oldSnapshots.push(newSnapshot);
    this._updatedCondition.onOff();

    while (this._oldSnapshots.length > MAX_OLD_SNAPSHOTS) {
      // Trim `_oldSnapshots` down to its allowed length.
      this._oldSnapshots.shift();
    }

    this._log.info(`Updated carets: Caret revision ${newRevNum}.`);

    return newRevNum;
  }
}
