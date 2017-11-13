// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import {
  Caret, CaretChange, CaretDelta, CaretOp, CaretSnapshot, RevisionNumber, Timestamp
} from 'doc-common';
import { TransactionSpec } from 'file-store';
import { TInt, TString } from 'typecheck';
import { Errors } from 'util-common';

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
   * {TransactionSpec} Spec for a transaction which when run will initialize the
   * portion of the file which this class is responsible for.
   */
  get _impl_initSpec() {
    const fc = this.fileCodec; // Avoids boilerplate immediately below.

    return new TransactionSpec(
      // Clear out old data, if any.
      fc.op_deletePathPrefix(Paths.CARET_PREFIX),

      // Initial revision number.
      fc.op_writePath(CaretControl.revisionNumberPath, 0),

      // Empty change #0.
      fc.op_writePath(Paths.forCaretChange(0), CaretChange.FIRST)
    );
  }

  /**
   * Subclass-specific implementation of `afterInit()`.
   */
  async _impl_afterInit() {
    // Any cached snapshots are no longer valid.
    this._snapshots.clear();
  }

  /**
   * Underlying implementation of `currentRevNum()`, as required by the
   * superclass.
   *
   * @returns {Int} The instantaneously-current revision number.
   */
  async _impl_currentRevNum() {
    const fc          = this.fileCodec;
    const storagePath = CaretControl.revisionNumberPath;
    const spec        = new TransactionSpec(
      fc.op_checkPathPresent(storagePath),
      fc.op_readPath(storagePath)
    );

    const transactionResult = await fc.transact(spec);
    return transactionResult.data.get(storagePath);
  }

  /**
   * Underlying implementation of `getChangeAfter()`, as required by the
   * superclass.
   *
   * @param {Int} baseRevNum Revision number for the base to get a change with
   *   respect to. Guaranteed to refer to the instantaneously-current revision
   *   or earlier.
   * @param {Int} timeoutMsec Maximum amount of time to allow in this call, in
   *   msec. Guaranteed to be a valid value as defined by {@link Timeouts}.
   * @param {Int} currentRevNum The instantaneously-current revision number that
   *   was determined just before this method was called.
   * @returns {CaretChange} Change with respect to the revision indicated by
   *   `baseRevNum`. Though the superclass allows it, this method never returns
   *   `null`.
   */
  async _impl_getChangeAfter(baseRevNum, timeoutMsec, currentRevNum) {
    if (currentRevNum === baseRevNum) {
      // The current revision is the same as the base, so we have to wait for
      // the file to change (or for the storage layer to time out), and then
      // check to see if in fact the revision number was changed.

      const fc   = this.fileCodec;
      const spec = new TransactionSpec(
        fc.op_timeout(timeoutMsec),
        fc.op_whenPathNot(CaretControl.revisionNumberPath, currentRevNum));

      // If this returns normally (doesn't throw), then we know it wasn't due
      // to hitting the timeout. And if it _is_ a timeout, then the exception
      // that's thrown is exactly what should be reported upward.
      await fc.transact(spec);

      // Verify that the revision number went up. It's a bug if it didn't.
      currentRevNum = await this.currentRevNum();
      if (currentRevNum <= baseRevNum) {
        throw Errors.wtf(`Revision number should have gone up. Instead was ${baseRevNum} then ${currentRevNum}.`);
      }
    }

    // There are two possible ways to calculate the result, namely (1) compose
    // all the changes that were made after `baseRevNum`, or (2) calculate the
    // OT diff between `baseRevNum` and `currentRevNum`. We're doing the latter
    // here, because it's a little simpler and because (as of this writing at
    // least) there isn't actually that much data stored as properties. (N.b.,
    // `BodyControl` does the (1) tactic.)

    const oldSnapshot = await this.getSnapshot(baseRevNum);
    const newSnapshot = await this.getSnapshot(currentRevNum);

    return oldSnapshot.diff(newSnapshot);
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
    return this._snapshots.getSnapshot(revNum);
  }

  /**
   * Main implementation of `update()`, as required by the superclass.
   *
   * @param {CaretSnapshot} baseSnapshot Snapshot of the base from which the
   *   change is defined.
   * @param {CaretChange} change The change to apply, same as for `update()`.
   * @param {CaretSnapshot} expectedSnapshot The implied expected result as
   *   defined by `update()`.
   * @returns {CaretChange|null} Result for the outer call to `update()`,
   *   or `null` if the application failed due to losing a race.
   */
  async _impl_update(baseSnapshot, change, expectedSnapshot) {
    this._maybeRemoveIdleSessions();

    // Instantaneously current (latest) revision of the document portion. We'll
    // find out if it turned out to remain current when we finally get to try
    // appending the (possibly modified) change, below.
    const current = await this.getSnapshot();

    if (baseSnapshot.revNum === current.revNum) {
      // The easy case, because the base revision is in fact the current
      // revision, so we don't have to transform the incoming delta. We merely
      // have to apply the given `delta` to the current revision. If it
      // succeeds, then we won the append race (if any).

      const success = await this.appendChange(change);

      if (!success) {
        // Turns out we lost an append race.
        return null;
      }

      return new CaretChange(change.revNum, CaretDelta.EMPTY);
    }

    // The hard case: The client has requested an application of a delta
    // against a revision of the document which is _not_ current. Though hard,
    // this is considerably simpler than the equivalent document-body update
    // operation, because of the nature of the data being managed (that is, a
    // single-level key-value map, whose contents are treated as atomic units).
    //
    // What we do is simply compose all of the revisions after the base on top
    // of the expected result to get the final result. We diff from the final
    // result both to get the actual change to append and to get the correction
    // to return to the caller.

    const finalContents = await this.getComposedChanges(
      expectedSnapshot.contents, baseSnapshot.revNum + 1, current.revNum + 1);

    if (finalContents.equals(current.contents)) {
      // The changes after the base either overwrote or included the contents of
      // the requested change, so there is nothing to append. We merely return a
      // diff that gets from the expected result to the already-current
      // snapshot.
      return expectedSnapshot.diff(current);
    }

    const finalSnapshot = new CaretSnapshot(current.revNum + 1, finalContents);
    const finalChange = current.diff(finalSnapshot)
      .withTimestamp(change.timestamp)
      .withAuthorId(change.authorId);

    // Attempt to append the change.

    const success = await this.appendChange(finalChange);

    if (!success) {
      // Turns out we lost an append race.
      return null;
    }

    // We won the race (or had no contention).
    return expectedSnapshot.diff(finalSnapshot);
  }

  /**
   * Subclass-specific implementation of {@link #validationStatus}.
   *
   * @returns {string} One of the constants defined by {@link ValidationStatus}.
   */
  async _impl_validationStatus() {
    let transactionResult;

    // Check the revision number.

    try {
      const fc = this.fileCodec;
      const spec = new TransactionSpec(
        fc.op_readPath(CaretControl.revisionNumberPath)
      );
      transactionResult = await fc.transact(spec);
    } catch (e) {
      this.log.error('Major problem trying to read file!', e);
      return ValidationStatus.STATUS_ERROR;
    }

    const data   = transactionResult.data;
    const revNum = data.get(CaretControl.revisionNumberPath);

    if (!revNum) {
      this.log.info('Corrupt document: Missing revision number.');
      return ValidationStatus.STATUS_ERROR;
    }

    try {
      RevisionNumber.check(revNum);
    } catch (e) {
      this.log.info('Corrupt document: Bogus revision number.');
      return ValidationStatus.STATUS_ERROR;
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
        ops.push(fc.op_readPath(Paths.forCaretChange(i)));
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
   * last time that was done.
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
   * Gets the `StoragePath` string corresponding to the indicated revision
   * number, specifically for the portion of the document controlled by this
   * class.
   *
   * @param {RevisionNumber} revNum The revision number.
   * @returns {string} The corresponding `StoragePath` string.
   */
  static _impl_pathForChange(revNum) {
    return Paths.forCaretChange(revNum);
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
