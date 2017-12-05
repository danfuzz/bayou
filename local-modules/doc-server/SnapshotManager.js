// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase, Errors } from 'util-common';

import BaseControl from './BaseControl';

/**
 * Holder of cached snapshots for a document portion, along with the ability to
 * generate new snapshots as requested.
 */
export default class SnapshotManager extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {BaseControl} control Controller for the portion of the document
   *   for which this instance will manage snapshots.
   */
  constructor(control) {
    super();

    /**
     * {BaseControl} Controller for the portion of the document for which this
     * instance manages snapshots.
     */
    this._control = BaseControl.check(control);

    /** {class} The delta class used by {@link #_control}. */
    this._deltaClass = control.constructor.deltaClass;

    /** {class} The snapshot class used by {@link #_control}. */
    this._snapshotClass = this._control.constructor.snapshotClass;

    /**
     * {Map<RevisionNumber, Promise<BaseSnapshot>>} Mapping from revision
     * numbers to corresponding snapshot promises. Sparse.
     */
    this._snapshots = new Map();

    /**
     * {Promise<true>|null} Promise which becomes resolved when a pending
     * request for retrieval of the stored snapshot is complete, or `null` if
     * no such request is "in flight." This is used to avoid redundant requests
     * for the snapshot.
     */
    this._storedSnapshotRetrieved = null;

    Object.seal(this);
  }

  /**
   * Drops all cached snapshots from the instance. This should be called when
   * the document portion is cleared or otherwise drastically altered.
   */
  clear() {
    this._snapshots.clear();
    this._control.log.detail('Cleared snapshot cache.');
  }

  /**
   * Implementation of {@link BaseControl#_impl_getSnapshot}, suitable for being
   * deferred to from a {@link BaseControl} subclass.
   *
   * @param {Int} revNum Which revision to get. Guaranteed to be a revision
   *   number for the instantaneously-current revision or earlier.
   * @returns {BaseSnapshot} Snapshot of the indicated revision.
   */
  async getSnapshot(revNum) {
    if (this._snapshots.size === 0) {
      // The cache doesn't have anything in it yet.
      if (this._storedSnapshotRetrieved === null) {
        // This is the first ever snapshot request; before doing anything else,
        // try to read the stored snapshot, and if available, use it to seed the
        // snapshot cache. Depending on its revision number and the one being
        // requested, it _might_ (but won't _necessarily_) end up being the base
        // used to satisfy this call. At the same time (well, right after), also
        // set up an entry for revision `0`, which allows for the rest of this
        // class to be a little simpler.
        this._storedSnapshotRetrieved = (async () => {
          const storedPromise = this._control.readStoredSnapshotOrNull();
          const stored = await storedPromise;

          if (stored !== null) {
            this._snapshots.set(stored.revNum, storedPromise);
          }

          if ((stored === null) || (stored.revNum !== 0)) {
            // Derive a snapshot for revision `0` in the standard way, that is,
            // by composing change 0 on top of an empty delta, requesting a
            // document result (`wantDocument = true` for the last argument).
            const rev0Contents = this._control.getComposedChanges(this._deltaClass.EMPTY, 0, 1, true);
            const rev0Snapshot = new this._snapshotClass(0, await rev0Contents);
            this._snapshots.set(0, rev0Snapshot);
          }

          this._storedSnapshotRetrieved = null;
          return true;
        })();
      }

      // Wait for initial snapshot retrieval and setup to be complete.
      await this._storedSnapshotRetrieved;
    }

    // Search backward through the full revisions for a base for forward
    // composition. **Note:** The initialization step above should have
    // guaranteed that we always find a suitable base revision, either the
    // stored snapshot or the constructed revision 0.

    let basePromise = null;
    let baseRevNum  = -1;

    for (let i = revNum; i >= 0; i--) {
      const v = this._snapshots.get(i);
      if (v) {
        basePromise = v;
        baseRevNum  = i;
        break;
      }
    }

    if (baseRevNum === revNum) {
      // We found a cached snapshot for the right revision!
      this._control.log.detail(`Found cached snapshot: r${revNum}`);
      return basePromise;
    }

    if (basePromise === null) {
      // Shouldn't happen, per above description (and code).
      throw Errors.wtf('Did not find a snapshot!');
    }

    // We didn't actully find a snapshot of the requested revision. Make it,
    // cache it, and return it.

    const result = this._makeSnapshot(revNum, basePromise);

    this._snapshots.set(revNum, result);

    return result;
  }

  /**
   * Makes the snapshot for the indicated revision, by composing all changes
   * from the indicated base revision.
   *
   * @param {Int} revNum Which revision to get. Guaranteed to be a revision
   *   number for the instantaneously-current revision or earlier.
   * @param {Promise<BaseSnapshot>} basePromise Promise for the base snapshot to
   *   use.
   * @returns {BaseSnapshot} Snapshot of the indicated revision.
   */
  async _makeSnapshot(revNum, basePromise) {
    const base = await basePromise;
    const contents =
      this._control.getComposedChanges(base.contents, base.revNum + 1, revNum + 1, true);
    const result = new this._snapshotClass(revNum, await contents);

    if (revNum === (base.revNum + 1)) {
      this._control.log.info(`Made snapshot: r${revNum} = r${base.revNum} + c${revNum}`);
    } else {
      this._control.log.info(`Made snapshot: r${revNum} = r${base.revNum} + [c${base.revNum + 1} .. c${revNum}]`);
    }

    return result;
  }
}
