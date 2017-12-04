// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BodyChange, BodyDelta, BodySnapshot, RevisionNumber } from 'doc-common';
import { TransactionSpec } from 'file-store';

import BaseControl from './BaseControl';
import Paths from './Paths';
import SnapshotManager from './SnapshotManager';
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
    super(fileAccess, 'body');

    /** {SnapshotManager} Snapshot manager. */
    this._snapshots = new SnapshotManager(this);

    Object.seal(this);
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
   * @returns {BodySnapshot} Snapshot of the indicated revision. Though the
   *   superclass allows it, this method never returns `null`.
   */
  async _impl_getSnapshot(revNum) {
    return this._snapshots.getSnapshot(revNum);
  }

  /**
   * Rebases a given change, such that it can be appended as the revision after
   * the indicated instantaneously-current snapshot.
   *
   * @param {BodyChange} change The change to apply, same as for
   *   {@link #update}, except additionally guaranteed to have a non-empty
   *  `delta`.
   * @param {BodySnapshot} baseSnapshot Snapshot of the base from which the
   *   change is defined. That is, this is the snapshot of `change.revNum - 1`.
   * @param {BodySnapshot} expectedSnapshot_unused The implied expected result
   *   as defined by {@link #update}.
   * @param {BodySnapshot} currentSnapshot An instantaneously-current snapshot.
   *   Guaranteed to be a different revision than `baseSnapshot`.
   * @returns {BodyChange} Rebased (transformed) change, which is suitable for
   *   appending as revision `currentSnapshot.revNum + 1`.
   */
  async _impl_rebase(change, baseSnapshot, expectedSnapshot_unused, currentSnapshot) {
    // The client has requested an application of a `change` against a revision
    // of the document (`baseSnapshot`) which is _not_ the current revision
    // (`currentSnapshot`).

    // Construct a combined delta for all the server changes made between
    // `baseSnapshot` and `currentSnapshot`.
    const serverDelta = await this.getComposedChanges(
      BodyDelta.EMPTY, baseSnapshot.revNum + 1, currentSnapshot.revNum + 1, false);

    // Rebase (transform) `change.delta` with regard to (on top of)
    // `serverDelta`. The `true` argument indicates that `serverDelta` should be
    // taken to have been applied to the document first (won any insert races or
    // similar).
    const finalDelta = serverDelta.transform(change.delta, true);

    return new BodyChange(currentSnapshot.revNum + 1, finalDelta, change.timestamp, change.authorId);
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
        fc.op_readPath(BodyControl.revisionNumberPath)
      );
      transactionResult = await fc.transact(spec);
    } catch (e) {
      this.log.error('Major problem trying to read file!', e);
      return ValidationStatus.STATUS_ERROR;
    }

    const data   = transactionResult.data;
    const revNum = data.get(BodyControl.revisionNumberPath);

    try {
      RevisionNumber.check(revNum);
    } catch (e) {
      this.log.info('Corrupt document: Bogus or missing revision number.');
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
        ops.push(fc.op_readPath(BodyControl.pathForChange(i)));
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
   * {string} `StoragePath` prefix string to use for file storage for the
   * portion of the document controlled by instances of this class.
   */
  static get _impl_pathPrefix() {
    return Paths.BODY_PREFIX;
  }

  /**
   * {class} Class (constructor function) of snapshot objects to be used with
   * instances of this class.
   */
  static get _impl_snapshotClass() {
    return BodySnapshot;
  }
}
