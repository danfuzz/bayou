// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Caret, CaretChange, CaretOp, CaretSnapshot } from 'doc-common';
import { TransactionSpec } from 'file-store';
import { RevisionNumber, Timestamp } from 'ot-common';
import { TInt, TString } from 'typecheck';

import BaseControl from './BaseControl';
import CaretColor from './CaretColor';
import Paths from './Paths';
import SnapshotManager from './SnapshotManager';
import ValidationStatus from './ValidationStatus';

/**
 * {Int} How long (in msec) that a session must be inactive before it gets
 * culled from the current caret snapshot.
 */
const MAX_SESSION_IDLE_MSEC = 5 * 60 * 1000; // Five minutes.

/**
 * Controller for the caret metadata of a particular document.
 *
 * **TODO:** Caret data should be ephemeral. As of this writing, old data will
 * never get purged from the underlying file.
 */
export default class CaretControl extends BaseControl {
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
     * {Int} When to next run {@link #_removeIdleSessions}. Initialized to `0`
     * so that the first check will happen soon after the document is loaded.
     */
    this._nextIdleCheck = 0;

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
  async changeFor(sessionId, docRevNum, index, length = 0) {
    TString.check(sessionId);
    RevisionNumber.check(docRevNum);
    TInt.nonNegative(index);
    TInt.nonNegative(length);

    // Construct the new/updated caret.

    const snapshot   = await this.getSnapshot();
    const oldCaret   = snapshot.getOrNull(sessionId);
    const lastActive = Timestamp.now();
    const newFields  = { revNum: docRevNum, lastActive, index, length };
    let caret;

    if (oldCaret === null) {
      newFields.color = CaretControl._pickSessionColor(sessionId, snapshot);
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
   * @returns {CaretSnapshot|null} Snapshot of the indicated revision, or
   *   `null` to indicate that the revision is not available.
   */
  async _impl_getSnapshot(revNum) {
    this._maybeRemoveIdleSessions();

    return this._snapshots.getSnapshot(revNum);
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

    const finalContents = await this.getComposedChanges(
      expectedSnapshot.contents, baseSnapshot.revNum + 1, currentSnapshot.revNum + 1, true);
    const finalSnapshot = new CaretSnapshot(currentSnapshot.revNum + 1, finalContents);
    const finalChange = currentSnapshot.diff(finalSnapshot)
      .withTimestamp(change.timestamp)
      .withAuthorId(change.authorId);

    return finalChange;
  }

  /**
   * Subclass-specific implementation of {@link #validationStatus}.
   *
   * @returns {string} One of the constants defined by {@link ValidationStatus}.
   */
  async _impl_validationStatus() {
    let transactionResult;

    // Check the revision number (mandatory) and stored snapshot (if present).

    try {
      const fc = this.fileCodec;
      const spec = new TransactionSpec(
        fc.op_readPath(CaretControl.revisionNumberPath),
        fc.op_readPath(CaretControl.storedSnapshotPath)
      );
      transactionResult = await fc.transact(spec);
    } catch (e) {
      this.log.error('Major problem trying to read file!', e);
      return ValidationStatus.STATUS_ERROR;
    }

    const data     = transactionResult.data;
    const revNum   = data.get(CaretControl.revisionNumberPath);
    const snapshot = data.get(CaretControl.storedSnapshotPath);

    try {
      RevisionNumber.check(revNum);
    } catch (e) {
      this.log.info('Corrupt document: Bogus or missing revision number.');
      return ValidationStatus.STATUS_ERROR;
    }

    if (snapshot) {
      try {
        CaretControl.snapshotClass.check(snapshot);
      } catch (e) {
        this.log.info('Corrupt document: Bogus stored snapshot (wrong class).');
        return ValidationStatus.STATUS_ERROR;
      }

      if (revNum < snapshot.revNum) {
        this.log.info('Corrupt document: Bogus stored snapshot (weird revision number).');
        return ValidationStatus.STATUS_ERROR;
      }
    }

    // Make sure all the changes can be read and decoded.

    const MAX = BaseControl.MAX_CHANGE_READS_PER_TRANSACTION;
    for (let i = 0; i <= revNum; i += MAX) {
      const lastI = Math.min(i + MAX - 1, revNum);
      try {
        await this.getChangeRange(i, lastI + 1);
      } catch (e) {
        this.log.info(`Corrupt document: Bogus change in range #${i}..${lastI}.`);
        return ValidationStatus.STATUS_ERROR;
      }
    }

    // Look for a few changes past the stored revision number to make sure
    // they're empty.

    try {
      const fc  = this.fileCodec;
      const ops = [];
      for (let i = revNum + 1; i <= (revNum + 10); i++) {
        ops.push(fc.op_readPath(CaretControl.pathForChange(i)));
      }
      const spec = new TransactionSpec(...ops);
      transactionResult = await fc.transact(spec);
    } catch (e) {
      this.log.info('Corrupt document: Weird empty-change read failure.');
      return ValidationStatus.STATUS_ERROR;
    }

    // In a valid doc, the loop body won't end up executing at all.
    for (const storagePath of transactionResult.data.keys()) {
      this.log.info('Corrupt document. Extra change at path:', storagePath);
      return ValidationStatus.STATUS_ERROR;
    }

    // All's well!

    return ValidationStatus.STATUS_OK;
  }

  /**
   * Perform idle session cleanup, but only if it's been long enough since the
   * last time that was done. If in fact cleanup is performed, it happens
   * _asynchronously_ with respect to the call to this method.
   */
  _maybeRemoveIdleSessions() {
    const now = Date.now();

    if (now >= this._nextIdleCheck) {
      // Check four times per max-idle period. We update {@link #_nextIdleCheck}
      // here (and not in the subsequent call), so that multiple checks can't
      // "sneak past the gate" as it were, between the time that we decide to
      // run the idle check and the would-be later time that the `async`
      // {@link _removeIdleSessions} method actually starts running.
      this._nextIdleCheck = now + (MAX_SESSION_IDLE_MSEC / 4);
      this._removeIdleSessions();
    }
  }

  /**
   * Removes sessions out of the snapshot that haven't been active recently.
   */
  async _removeIdleSessions() {
    this.log.info('Checking for inactive sessions.');

    const snapshot = await this.getSnapshot();

    // **Note:** We have to wait for the `snapshot` to be ready before getting
    // the current time. (That is, the following line cannot be moved above the
    // previous line.) Otherwise, we might produce a change with an out-of-order
    // timestamp.
    const now         = Timestamp.now();
    const minTime     = now.addMsec(-MAX_SESSION_IDLE_MSEC);
    let   newSnapshot = snapshot;

    for (const [sessionId, caret] of snapshot.entries()) {
      if (minTime.compareTo(caret.lastActive) > 0) {
        // Too old!
        this.log.info(`[${sessionId}] Became inactive.`);
        newSnapshot = newSnapshot.withoutSession(sessionId);
      }
    }

    if (snapshot === newSnapshot) {
      this.log.info('No inactive sessions.');
      return;
    }

    newSnapshot = newSnapshot.withRevNum(snapshot.revNum + 1);

    const change = snapshot.diff(newSnapshot).withTimestamp(now);

    try {
      await this.update(change);
    } catch (e) {
      // Probably a timeout after losing too many races. Though it's
      // log-worthy, it's not a showstopper. The sessions will ultimately get
      // cleaned up by another run of the idle timeout (either on this machine
      // or some other one).
      this.log.warn('Error while removing idle sessions.', e);
    }
  }

  /**
   * Indicates that a particular session was reaped (GC'ed). This is a "friend"
   * method which gets called by `FileComplex`.
   *
   * @param {string} sessionId ID of the session that got reaped.
   */
  async _sessionReaped(sessionId) {
    const snapshot = await this.getSnapshot();

    if (snapshot.has(sessionId)) {
      const newSnapshot =
        snapshot.withoutSession(sessionId).withRevNum(snapshot.revNum + 1);
      const change =
        snapshot.diff(newSnapshot).withTimestamp(Timestamp.now());
      this.log.info(`[${sessionId}] Local session has ended.`);

      try {
        await this.update(change);
      } catch (e) {
        // Probably a timeout after losing too many races. Though it's
        // log-worthy, it's not a showstopper. The session will ultimately get
        // cleaned up by the idle timeout.
        this.log.warn(`[${sessionId}] Error while reaping.`, e);
      }
    } else {
      // Some other server probably got to it first.
      this.log.info(`[${sessionId}] Asked to reap session that was already gone.`);
    }
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
   * Picks a color to use for a new session.
   *
   * @param {string} sessionId The ID for the new session (used as a
   *   pseudo-random seed).
   * @param {CaretSnapshot} snapshot Snapshot upon which to base the decision.
   * @returns {string} The color to use, in CSS hex form.
   */
  static _pickSessionColor(sessionId, snapshot) {
    // Extract all the currently-used caret colors.
    const usedColors = [];
    for (const [sessionId_unused, caret] of snapshot.entries()) {
      usedColors.push(caret.color);
    }

    return CaretColor.colorForSession(sessionId, usedColors);
  }
}
