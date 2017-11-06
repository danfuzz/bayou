// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { PropertyChange, PropertyDelta, PropertySnapshot } from 'doc-common';
import { TransactionSpec } from 'file-store';
import { Errors } from 'util-common';

import BaseControl from './BaseControl';
import Paths from './Paths';
import SnapshotManager from './SnapshotManager';
import ValidationStatus from './ValidationStatus';

/**
 * Controller for the property metadata of a particular document.
 */
export default class PropertyControl extends BaseControl {
  /**
   * Constructs an instance.
   *
   * @param {FileAccess} fileAccess Low-level file access and related
   *   miscellanea.
   */
  constructor(fileAccess) {
    super(fileAccess, 'prop');

    /** {SnapshotManager} Snapshot manager. */
    this._snapshots = new SnapshotManager(this);

    Object.seal(this);
  }

  /**
   * {TransactionSpec} Spec for a transaction which when run will initialize the
   * portion of the file which this class is responsible for.
   */
  get _impl_initSpec() {
    const fc = this.fileCodec; // Avoids boilerplate immediately below.

    return new TransactionSpec(
      // Clear out old property data, if any.
      fc.op_deletePathPrefix(Paths.PROPERTY_PREFIX),

      // Initial revision number.
      fc.op_writePath(Paths.PROPERTY_REVISION_NUMBER, 0),

      // Empty change #0.
      fc.op_writePath(Paths.forPropertyChange(0), PropertyChange.FIRST)
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
    const storagePath = Paths.PROPERTY_REVISION_NUMBER;
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
   *   was determined just before this method was called.
   * @returns {PropertyChange} Change with respect to the revision indicated by
   *   `baseRevNum`. Though the superclass allows it, this method never returns
   *   `null`.
   */
  async _impl_getChangeAfter(baseRevNum, currentRevNum) {
    // Wait for the revision number to change using a transaction. Iterate
    // because sometimes the transaction can return without an actual change
    // happening.
    for (;;) {
      if (baseRevNum < currentRevNum) {
        // The document's revision is in fact newer than the base, so we can now
        // stop waiting and return a result.
        break;
      }

      // Wait for the file to change (or for the storage layer to time out), and
      // then iterate to see if in fact the change updated the document revision
      // number.

      const fc   = this.fileCodec;
      const ops  = [fc.op_whenPathNot(Paths.PROPERTY_REVISION_NUMBER, currentRevNum)];
      const spec = new TransactionSpec(...ops);

      try {
        await fc.transact(spec);
      } catch (e) {
        if (!Errors.isTimedOut(e)) {
          // It's _not_ a timeout, so we should propagate the error.
          throw e;
        }

        // It's a timeout, so just fall through and iterate.
        this.log.info('Storage layer timeout in `getChangeAfter()`.');
      }

      currentRevNum = await this.currentRevNum();
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
   * @returns {PropertySnapshot|null} Snapshot of the indicated revision, or
   *   `null` to indicate that the revision is not available.
   */
  async _impl_getSnapshot(revNum) {
    return this._snapshots.getSnapshot(revNum);
  }

  /**
   * Main implementation of `update()`, as required by the superclass.
   *
   * @param {PropertySnapshot} baseSnapshot Snapshot of the base from which the
   *   change is defined.
   * @param {PropertyChange} change The change to apply, same as for `update()`.
   * @param {PropertySnapshot} expectedSnapshot The implied expected result as
   *   defined by `update()`.
   * @returns {PropertyChange|null} Result for the outer call to `update()`,
   *   or `null` if the application failed due to losing a race.
   */
  async _impl_update(baseSnapshot, change, expectedSnapshot) {
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

      return new PropertyChange(change.revNum, PropertyDelta.EMPTY);
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

    const finalSnapshot = new PropertySnapshot(current.revNum + 1, finalContents);
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
    // **TODO:** Actually validate.
    return ValidationStatus.STATUS_OK;
  }

  /**
   * {string} `StoragePath` string which stores the current revision number for
   * the portion of the document controlled by this class.
   */
  static get _impl_revisionNumberPath() {
    return Paths.PROPERTY_REVISION_NUMBER;
  }

  /**
   * {class} Class (constructor function) of snapshot objects to be used with
   * instances of this class.
   */
  static get _impl_snapshotClass() {
    return PropertySnapshot;
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
    return Paths.forPropertyChange(revNum);
  }
}
