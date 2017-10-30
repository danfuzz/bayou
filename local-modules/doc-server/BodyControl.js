// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BodyChange, BodyDelta, BodySnapshot, RevisionNumber } from 'doc-common';
import { TransactionSpec } from 'file-store';
import { Errors } from 'util-common';

import BaseControl from './BaseControl';
import Paths from './Paths';
import ValidationStatus from './ValidationStatus';

/**
 * Controller for a given document's body content.
 */
export default class BodyControl extends BaseControl {
  /**
   * Constructs an instance.
   *
   * @param {FileAccess} fileAccess Low-level file access and related
   *   miscellanea.
   */
  constructor(fileAccess) {
    super(fileAccess);

    /**
     * {Map<RevisionNumber, BodySnapshot>} Mapping from revision numbers to
     * corresponding document snapshots. Sparse.
     */
    this._snapshots = new Map();

    Object.seal(this);
  }

  /**
   * Gets a particular change to the document. The document consists of a
   * sequence of changes, each modifying revision N of the document to produce
   * revision N+1.
   *
   * @param {Int} revNum The revision number of the change. The result is the
   *   change which produced that revision. E.g., `0` is a request for the first
   *   change (the change from the empty document).
   * @returns {BodyChange} The requested change.
   */
  async getChange(revNum) {
    RevisionNumber.check(revNum);

    const changes = await this.getChangeRange(revNum, revNum + 1);
    return changes[0];
  }

  /**
   * {TransactionSpec} Spec for a transaction which when run will initialize the
   * portion of the file which this class is responsible for.
   */
  get _impl_initSpec() {
    const fc = this.fileCodec; // Avoids boilerplate immediately below.

    return new TransactionSpec(
      // If there was any body content (e.g. and most likely data in an earlier
      // schema, this clears it out.
      fc.op_deletePathPrefix(Paths.BODY_PREFIX),

      // Initial revision number.
      fc.op_writePath(Paths.BODY_REVISION_NUMBER, 0),

      // Empty change #0 (per documented interface).
      fc.op_writePath(Paths.forBodyChange(0), BodyChange.FIRST)
    );
  }

  /**
   * Subclass-specific implementation of `afterInit()`.
   */
  async _impl_afterInit() {
    // Any cached snapshots are no longer valid.
    this._snapshots = new Map();
  }

  /**
   * Underlying implementation of `currentRevNum()`, as required by the
   * superclass.
   *
   * @returns {Int} The instantaneously-current revision number.
   */
  async _impl_currentRevNum() {
    const fc          = this.fileCodec;
    const storagePath = Paths.BODY_REVISION_NUMBER;
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
   * @param {Int} currentRevNum The instantaneously-current revision number that
   *   was determined just before this method was called, and which should be
   *   treated as the actually-current revision number at the start of this
   *   method.
   * @returns {BodyChange} Delta and associated information. Though the
   *   superclass allows it, this method never returns `null`.
   */
  async _impl_getChangeAfter(baseRevNum, currentRevNum) {
    for (;;) {
      if (baseRevNum < currentRevNum) {
        // The document's revision is in fact newer than the base, so we can now
        // form and return a result. Compose all the deltas from the revision
        // after the base through and including the current revision.
        const delta = await this.getComposedChanges(
          BodyDelta.EMPTY, baseRevNum + 1, currentRevNum + 1);
        return new BodyChange(currentRevNum, delta);
      }

      // Wait for the file to change (or for the storage layer to time out), and
      // then iterate to see if in fact the change updated the document revision
      // number.
      const fc   = this.fileCodec;
      const ops  = [fc.op_whenPathNot(Paths.BODY_REVISION_NUMBER, currentRevNum)];
      const spec = new TransactionSpec(...ops);
      try {
        await fc.transact(spec);
      } catch (e) {
        if (!Errors.isTimedOut(e)) {
          // It's _not_ a timeout, so we should propagate the error.
          throw e;
        }
        // It's a timeout, so just fall through and iterate.
        this.log.info('Storage layer timeout in `getChangeAfter`.');
      }

      // Update what we think of as the current revision number, and iterate to
      // try again.
      currentRevNum = await this.currentRevNum();
    }
  }

  /**
   * Underlying implementation of `getSnapshot()`, as required by the
   * superclass.
   *
   * @param {Int} revNum Which revision to get. Guaranteed to be a revision
   *   number for the instantaneously-current revision or earlier.
   * @returns {BodySnapshot} Snapshot of the indicated revision. Though the
   *   superclass allows it, this method never returns `null`.
   */
  async _impl_getSnapshot(revNum) {
    // Search backward through the full revisions for a base for forward
    // composition.
    let base = null;
    for (let i = revNum; i >= 0; i--) {
      const v = this._snapshots.get(i);
      if (v) {
        base = v;
        break;
      }
    }

    if (base && (base.revNum === revNum)) {
      // Found the right revision!
      return base;
    }

    // We didn't actully find a snapshot of the requested revision. Apply deltas
    // to the base to produce the desired revision. Store it, and return it.

    const contents = (base === null)
      ? this.getComposedChanges(BodyDelta.EMPTY, 0,               revNum + 1)
      : this.getComposedChanges(base.contents,   base.revNum + 1, revNum + 1);
    const result = new BodySnapshot(revNum, await contents);

    this.log.detail('Made snapshot for revision:', revNum);

    this._snapshots.set(revNum, result);
    return result;
  }

  /**
   * Main implementation of `update()`, as required by the superclass.
   *
   * @param {BodySnapshot} baseSnapshot Snapshot of the base from which the
   *   change is defined.
   * @param {BodyChange} change The change to apply, same as for `update()`.
   * @param {BodySnapshot} expectedSnapshot The implied expected result as
   *   defined by `update()`.
   * @returns {BodyChange|null} Result for the outer call to `update()`,
   *   or `null` if the application failed due losing a race.
   */
  async _impl_update(baseSnapshot, change, expectedSnapshot) {
    // Instantaneously current (latest) revision of the document. We'll find out
    // if it turned out to remain current when we finally get to try appending
    // the (possibly modified) change, below.
    const current = await this.getSnapshot();

    if (baseSnapshot.revNum === current.revNum) {
      // The easy case, because the base revision is in fact the current
      // revision of the document, so we don't have to transform the incoming
      // delta. We merely have to apply the given `delta` to the current
      // revision. If it succeeds, then we won the append race (if any).

      const success = await this.appendChange(change);

      if (!success) {
        // Turns out we lost an append race.
        return null;
      }

      return new BodyChange(change.revNum, BodyDelta.EMPTY);
    }

    // The hard case: The client has requested an application of a delta
    // (hereafter `dClient`) against a revision of the document which is _not_
    // the current revision (hereafter, `rBase` for the common base and
    // `rCurrent` for the current revision). Here's what we do:
    //
    // 0. Definitions of input:
    //    * `dClient` -- Delta (ops) to apply, as requested by the client.
    //    * `rBase` -- Base revision to apply the delta to.
    //    * `rCurrent` -- Current (latest) revision of the document.
    //    * `rExpected` -- The implied expected result of application. This is
    //      `rBase.compose(dClient)` as revision number `rBase.revNum + 1`.
    // 1. Construct a combined delta for all the server changes made between
    //    `rBase` and `rCurrent`. This is `dServer`.
    // 2. Transform (rebase) `dClient` with regard to (on top of) `dServer`.
    //    This is `dNext`. If `dNext` turns out to be empty, stop here and
    //    report that fact.
    // 3. Apply `dNext` to `rCurrent`, producing `rNext` as the new current
    //    server revision.
    // 4. Construct a delta from `rExpected` to `rNext` (that is, the diff).
    //    This is `dCorrection`. Return this to the client; they will compose
    //    `rExpected` with `dCorrection` to arrive at `rNext`.

    // (0) Assign incoming arguments to variables that correspond to the
    //     description immediately above.

    const dClient   = change.delta;
    const rBase     = baseSnapshot;
    const rExpected = expectedSnapshot;
    const rCurrent  = current;

    // (1)

    const dServer = await this.getComposedChanges(
      BodyDelta.EMPTY, rBase.revNum + 1, rCurrent.revNum + 1);

    // (2)

    // The `true` argument indicates that `dServer` should be taken to have been
    // applied first (won any insert races or similar).
    const dNext = dServer.transform(dClient, true);

    if (dNext.isEmpty()) {
      // It turns out that nothing changed. **Note:** It is unclear whether this
      // can actually happen in practice, given that we already return early
      // (in `update()`) if we are asked to apply an empty delta.
      return new BodyChange(rCurrent.revNum, BodyDelta.EMPTY);
    }

    // (3)

    const rNextNum      = rCurrent.revNum + 1;
    const appendSuccess = await this.appendChange(
      new BodyChange(rNextNum, dNext, change.timestamp, change.authorId));

    if (!appendSuccess) {
      // Turns out we lost an append race.
      return null;
    }

    const rNext = await this.getSnapshot(rNextNum);

    // (4)

    // **Note:** The result's `revNum` is the same as `rNext`'s, which is
    // exactly what we want.
    const dCorrection = rExpected.diff(rNext);
    return dCorrection;
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
        fc.op_readPath(Paths.BODY_REVISION_NUMBER)
      );
      transactionResult = await fc.transact(spec);
    } catch (e) {
      this.log.error('Major problem trying to read file!', e);
      return ValidationStatus.STATUS_ERROR;
    }

    const data   = transactionResult.data;
    const revNum = data.get(Paths.BODY_REVISION_NUMBER);

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
        ops.push(fc.op_readPath(Paths.forBodyChange(i)));
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
   * {string} `StoragePath` string which stores the current revision number for
   * the portion of the document controlled by this class.
   */
  static get _impl_revisionNumberPath() {
    return Paths.BODY_REVISION_NUMBER;
  }

  /**
   * {class} Class (constructor function) of snapshot objects to be used with
   * instances of this class.
   */
  static get _impl_snapshotClass() {
    return BodySnapshot;
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
    return Paths.forBodyChange(revNum);
  }
}
