// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BodyChange, BodyDelta, BodySnapshot } from 'doc-common';

import DurableControl from './DurableControl';
import Paths from './Paths';
import SnapshotManager from './SnapshotManager';

/**
 * Controller for a given document's body content.
 */
export default class BodyControl extends DurableControl {
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
