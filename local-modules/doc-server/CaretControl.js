// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Caret, CaretDelta, CaretOp, CaretSnapshot, RevisionNumber, Timestamp }
  from 'doc-common';
import { TransactionSpec } from 'file-store';
import { TInt, TString } from 'typecheck';
import { ColorSelector, CommonBase, PromCondition, PromDelay }
  from 'util-common';

import FileComplex from './FileComplex';
import Paths from './Paths';

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

/** {Int} How many times to retry session removal. */
const MAX_SESSION_REMOVAL_RETRIES = 10;

/** {Int} How long (in msec) to wait between session removal retries. */
const SESSION_REMOVAL_RETRY_DELAY_MSEC = 10 * 1000; // Ten seconds.

/**
 * Controller for the active caret info for a given document.
 *
 * There is only ever exactly one instance of this class per document, no matter
 * how many active editors there are on that document. (This guarantee is
 * provided by virtue of the fact that `DocServer` only ever creates one
 * `FileComplex` per document, and each `FileComplex` instance only ever makes
 * one instance of this class.
 *
 * **TODO:** This class needs to store caret info via the `file-store`,
 * instead of being purely ephemeral.
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

    /** {FileCodec} File-codec wrapper to use. */
    this._fileCodec = fileComplex.fileCodec;

    /**
     * {CaretSnapshot} Latest caret info. Starts out as an empty stub; gets
     * filled in as updates arrive.
     */
    this._snapshot = new CaretSnapshot(0, []);

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
    await this._removeInactiveSessions();

    const minRevNum     = this._oldSnapshots[0].revNum;
    const currentRevNum = this._snapshot.revNum;

    if ((baseRevNum < minRevNum) || (baseRevNum > currentRevNum)) {
      throw new Error(`Revision not available: ${baseRevNum}`);
    }

    // Grab the snapshot to use as the base. **Note:** If `baseRevNum` is in
    // fact the current revision number, this will turn out to be the same as
    // `_snapshot` because `_snapshot` is always the last element of
    // `_oldSnapshots`.
    const oldSnapshot = this._oldSnapshots[baseRevNum - minRevNum];

    if (baseRevNum === currentRevNum) {
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
    await this._removeInactiveSessions();

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

    // Rename for method-internal convenience. (The argument name serves a
    // didactic purpose.)
    const revNum = docRevNum;

    const caretStr = (length === 0)
      ? `@${index}`
      : `[${index}..${index + length - 1}]`;
    this._log.info(`[${sessionId}] Caret update: r${revNum}, ${caretStr}`);

    // Build up an array of ops to apply to the current snapshot.

    const snapshot = this._snapshot;
    const oldCaret = snapshot.caretForSession(sessionId);
    let ops;

    if (oldCaret === null) {
      const lastActive = Timestamp.now();
      const color      = this._colorSelector.nextColorHex();
      const fields     = { revNum, lastActive, index, length, color };
      const newCaret   = new Caret(sessionId, Object.entries(fields));

      ops = [CaretOp.op_beginSession(newCaret)];
    } else {
      const lastActive = Timestamp.now();
      const fields     = { revNum, lastActive, index, length };
      const newCaret   = new Caret(oldCaret, Object.entries(fields));
      const diff       = oldCaret.diff(newCaret);

      ops = [...diff.ops]; // `[...x]` so as to be mutable for `push()` below.
    }

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
  async _applyOps(ops) {
    const snapshot  = this._snapshot;
    const newRevNum = snapshot.revNum + 1;

    // Add the op to bump up the revision number, and construct the new
    // snapshot.
    ops.push(CaretOp.op_updateRevNum(newRevNum));
    const newSnapshot = snapshot.compose(new CaretDelta(ops));

    // Perform a transaction to update the stored carets to match the new
    // state of affairs. This can fail if there is a data storage race. (Higher
    // level logic will need to retry, if appropriate.)
    await this._storeCarets(newSnapshot);

    // Update the snapshot locally, and wake up any waiters.
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

  /**
   * Removes sessions that haven't been active recently out of the snapshot.
   */
  async _removeInactiveSessions() {
    const minTime = Timestamp.now().addMsec(-MAX_SESSION_IDLE_MSEC);
    const ops = [];

    for (const c of this._snapshot.carets) {
      if (minTime.compareTo(c.lastActive) > 0) {
        // Too old!
        this._log.info(`[${c.sessionId}] Caret became inactive.`);
        ops.push(CaretOp.op_endSession(c.sessionId));
      }
    }

    if (ops.length !== 0) {
      await this._removeSessionsWithRetry(ops);
    }
  }

  /**
   * Stores the carets represented in the given new snapshot, to the underlying
   * file storage. This throws an error if there was a storage race and this
   * call lost.
   *
   * @param {CaretSnapshot} snapshot Carets to store.
   */
  async _storeCarets(snapshot) {
    const oldRevNum = this._snapshot.revNum;
    const newRevNum = snapshot.revNum;
    const fc        = this._fileCodec;

    if (newRevNum !== (oldRevNum + 1)) {
      throw new Error('Unexpected `revNum` for `_storeCarets()`.');
    }

    // **TODO:** For now, we just update the caret revision number without even
    // checking for races. Ultimately, this needs to do a lot more! See the
    // work-in-progress version of this, below.
    const spec = new TransactionSpec(
      fc.op_writePath(Paths.CARET_REVISION_NUMBER, newRevNum));
    await this._fileCodec.transact(spec);
  }

  /**
   * Stores the carets represented in the given new snapshot, to the underlying
   * file storage. This throws an error if there was a storage race and this
   * call lost.
   *
   * **TODO:** This is a non-functional work-in-progress version of the method.
   *
   * @param {CaretSnapshot} snapshot Carets to store.
   */
  async _storeCarets_workInProgress(snapshot) {
    const oldRevNum = this._snapshot.revNum;
    const newRevNum = snapshot.revNum;
    const fc        = this._fileCodec;

    if (newRevNum !== (oldRevNum + 1)) {
      throw new Error('Unexpected `revNum` for `_storeCarets()`.');
    }

    try {
      // **TODO:** For now, we just update the caret revision number.
      // Ultimately, we should also be storing carets.
      const spec = new TransactionSpec(
        fc.op_checkPathIs(Paths.CARET_REVISION_NUMBER, oldRevNum),
        fc.op_writePath(Paths.CARET_REVISION_NUMBER, newRevNum));
      await this._fileCodec.transact(spec);
    } catch (e) {
      // We probably lost a race, but it could also be that the caret revision
      // number is missing (new-ish file) or corrupt. The code below tries to
      // sort it all out.
      this._log.info('Failed to write carets.', e);
    }

    // Read the revision number (which might be absent), and take further action
    // based on it. We don't try to catch errors here, because there's nothing
    // we can do to recover at this point. Moreover, we always throw at the end
    // of whatever we do, so that the higher layer will be set up to retry (or
    // it might just itself fail).

    let spec = new TransactionSpec(fc.op_readPath(Paths.CARET_REVISION_NUMBER));
    const transactionResult = await this._fileCodec.transact(spec);
    const revNum = transactionResult.data[Paths.CARET_REVISION_NUMBER];

    if (((typeof revNum) === 'number') && (revNum >= newRevNum)) {
      // Stored revision number indicates a data storage race loss. Just throw,
      // so that the higher layer can recover (or fail).
      throw new Error('Lost data storage race.');
    }

    if (revNum === undefined) {
      // No carets ever stored.
      this._log.info('Writing initial caret revision number.');
    } else {
      // The revision number is probably corrupt.
      this._log.warn('Likely corrupt caret info. Resetting.');
    }

    spec = new TransactionSpec(fc.op_writePath(Paths.CARET_REVISION_NUMBER, 0));
    await this._fileCodec.transact(spec);
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
      this._log.wtf('`caretForSnapshot` not defined? Snapshot:', snapshot);
    }

    const oldCaret = snapshot.caretForSession(sessionId);

    if (oldCaret !== null) {
      const ops   = [CaretOp.op_endSession(sessionId)];

      this._log.info(`[${sessionId}] Caret removed.`);
      await this._removeSessionsWithRetry(ops);
    }
  }

  /**
   * Apply ops which are session removals, with retry logic. This is called
   * during session cleanup, in a context where it's okay if it ultimately
   * fails, which is why we just warn when that happens.
   *
   * @param {array<CaretOp>} ops Session removal ops.
   */
  async _removeSessionsWithRetry(ops) {
    for (let i = 0; i < MAX_SESSION_REMOVAL_RETRIES; i++) {
      try {
        await this._applyOps(ops);
      } catch (e) {
        this._log.warn('Caret removal failed.', e);
      }

      // Wait a moment, and then make sure we have the latest snapshot (but we
      // still might lose another update race).

      await PromDelay.resolve(SESSION_REMOVAL_RETRY_DELAY_MSEC);

      try {
        await this.snapshot();
      } catch (e) {
        this._log.warn('`snapshot()` failed during caret removal.', e);
      }
    }

    this._log.warn('Caret removal failed too many times. Giving up!');
  }
}
