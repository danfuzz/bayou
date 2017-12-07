// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { PropertySnapshot } from 'doc-common';
import { TransactionSpec } from 'file-store';
import { RevisionNumber } from 'ot-common';

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
   * @returns {PropertySnapshot|null} Snapshot of the indicated revision, or
   *   `null` to indicate that the revision is not available.
   */
  async _impl_getSnapshot(revNum) {
    return this._snapshots.getSnapshot(revNum);
  }

  /**
   * Rebases a given change, such that it can be appended as the revision after
   * the indicated instantaneously-current snapshot.
   *
   * @param {PropertyChange} change The change to apply, same as for
   *   {@link #update}, except additionally guaranteed to have a non-empty
   *  `delta`.
   * @param {PropertySnapshot} baseSnapshot Snapshot of the base from which the
   *   change is defined. That is, this is the snapshot of `change.revNum - 1`.
   * @param {PropertySnapshot} expectedSnapshot The implied expected result as
   *   defined by {@link #update}.
   * @param {PropertySnapshot} currentSnapshot An instantaneously-current
   *   snapshot. Guaranteed to be a different revision than `baseSnapshot`.
   * @returns {PropertyChange} Rebased (transformed) change, which is suitable
   *   for appending as revision `currentSnapshot.revNum + 1`.
   */
  async _impl_rebase(change, baseSnapshot, expectedSnapshot, currentSnapshot) {
    // The client has requested an application of a delta against a revision of
    // the document which is _not_ current. Though nontrivial, this is
    // considerably simpler than the equivalent document-body update operation,
    // because of the nature of the data being managed (that is, a single-level
    // key-value map, whose values are treated as atomic units).
    //
    // What we do is simply compose all of the revisions after the base on top
    // of the expected result to get the final result. We diff from the final
    // result to get the actual change to append.

    const finalContents = await this.getComposedChanges(
      expectedSnapshot.contents, baseSnapshot.revNum + 1, currentSnapshot.revNum + 1, true);

    const finalSnapshot = new PropertySnapshot(currentSnapshot.revNum + 1, finalContents);
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

    // Check the revision number.

    try {
      const fc = this.fileCodec;
      const spec = new TransactionSpec(
        fc.op_readPath(PropertyControl.revisionNumberPath)
      );
      transactionResult = await fc.transact(spec);
    } catch (e) {
      this.log.error('Major problem trying to read file!', e);
      return ValidationStatus.STATUS_ERROR;
    }

    const data   = transactionResult.data;
    const revNum = data.get(PropertyControl.revisionNumberPath);

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
        ops.push(fc.op_readPath(PropertyControl.pathForChange(i)));
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
    return Paths.PROPERTY_PREFIX;
  }

  /**
   * {class} Class (constructor function) of snapshot objects to be used with
   * instances of this class.
   */
  static get _impl_snapshotClass() {
    return PropertySnapshot;
  }
}
