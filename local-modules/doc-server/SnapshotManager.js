// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

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
    // Search backward through the full revisions for a base for forward
    // composition.
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
      // Found the right revision!
      this._control.log.detail(`Found snapshot: r${revNum}`);
      return basePromise;
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
   * @param {Promise<BaseSnapshot>|null} basePromise Promise for the base
   *   snapshot to use, or `null` to start from revision `0`.
   * @returns {BaseSnapshot} Snapshot of the indicated revision.
   */
  async _makeSnapshot(revNum, basePromise) {
    const base = await basePromise;

    const baseArgs = (base === null)
      ? [this._deltaClass.EMPTY, 0]
      : [base.contents,          base.revNum + 1];
    const contents = this._control.getComposedChanges(...baseArgs, revNum + 1);
    const result = new this._snapshotClass(revNum, await contents);

    if (base === null) {
      const endRev = (revNum === 0) ? '' : ` .. c${revNum}`;
      this._control.log.info(`Made snapshot: r${revNum} = c0${endRev}`);
    } else if (revNum === (base.revNum + 1)) {
      this._control.log.info(`Made snapshot: r${revNum} = r${base.revNum} + c${revNum}`);
    } else {
      this._control.log.info(`Made snapshot: r${revNum} = r${base.revNum} + [c${base.revNum + 1} .. c${revNum}]`);
    }

    return result;
  }
}
