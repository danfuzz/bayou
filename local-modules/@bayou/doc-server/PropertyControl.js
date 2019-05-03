// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { PropertySnapshot } from '@bayou/doc-common';

import { DurableControl } from './DurableControl';
import { Paths } from './Paths';
import { SnapshotManager } from './SnapshotManager';

/**
 * Controller for the property metadata of a particular document.
 */
export class PropertyControl extends DurableControl {
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
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {PropertySnapshot|null} Snapshot of the indicated revision, or
   *   `null` to indicate that the revision is not available.
   */
  async _impl_getSnapshot(revNum, timeoutMsec = null) {
    return this._snapshots.getSnapshot(revNum, timeoutMsec);
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
   * Implementation as required by the superclass.
   *
   * @param {PropertyChange} change_unused Change to apply.
   * @param {PropertySnapshot} baseSnapshot_unused The base snapshot the change
   *   is being applied to.
   * @throws {Error} Thrown if `change` is not valid as a change to
   *   `baseSnapshot`.
   */
  _impl_validateChange(change_unused, baseSnapshot_unused) {
    // **TODO:** Implement this!
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
