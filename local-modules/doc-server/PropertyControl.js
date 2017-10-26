// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { PropertyChange, PropertySnapshot } from 'doc-common';
import { TransactionSpec } from 'file-store';
import { Delay } from 'promise-util';

import BaseControl from './BaseControl';
import Paths from './Paths';
import ValidationStatus from './ValidationStatus';

/**
 * Controller for the property metadata of a particular document.
 *
 * **TODO:** Store properties to the file.
 */
export default class PropertyControl extends BaseControl {
  /**
   * Constructs an instance.
   *
   * @param {FileAccess} fileAccess Low-level file access and related
   *   miscellanea.
   */
  constructor(fileAccess) {
    super(fileAccess);

    /** {PropertySnapshot} Current snapshot. */
    this._snapshot = PropertySnapshot.EMPTY;

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
    // No action needed... yet.
  }

  /**
   * Underlying implementation of `currentRevNum()`, as required by the
   * superclass.
   *
   * @returns {Int} The instantaneously-current revision number.
   */
  async _impl_currentRevNum() {
    return this._snapshot.revNum;
  }

  /**
   * Underlyingimplementation of `getChangeAfter()`, as required by the
   * superclass.
   *
   * @param {Int} baseRevNum Revision number for the base to get a change with
   *   respect to. Guaranteed to refer to the instantaneously-current revision
   *   or earlier.
   * @param {Int} currentRevNum_unused The instantaneously-current revision
   *   number that was determined just before this method was called.
   * @returns {PropertyChange|null} Change with respect to the revision
   *   indicated by `baseRevNum`, or `null` to indicate that the revision was
   *   not available as a base.
   */
  async _impl_getChangeAfter(baseRevNum, currentRevNum_unused) {
    // **TODO:** Real implementation.

    const oldSnapshot = this._snapshot;

    if (oldSnapshot.revNum !== baseRevNum) {
      return null;
    }

    // Just spin (with delays) waiting for a change.
    for (;;) {
      await Delay.resolve(2000);
      if (oldSnapshot !== this._snapshot) {
        break;
      }
      this.log('Waiting for property update...');
    }

    return oldSnapshot.diff(this._snapshot);
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
    // **TODO:** Real implementation.

    const snapshot = this._snapshot;
    return (revNum === snapshot.revNum) ? snapshot : null;
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
   *   or `null` if the application failed due losing a race.
   */
  async _impl_update(baseSnapshot, change, expectedSnapshot) {
    // **TODO:** Real implementation.

    if (this._snapshot === baseSnapshot) {
      this._snapshot = expectedSnapshot;
    } else {
      // This is arguably super-wrong, but it will work well enough to bootstrap
      // the rest of the implementation.
      this._snapshot = this._snapshot.compose(change);
    }

    return expectedSnapshot.diff(this._snapshot);
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
   * {class} Class (constructor function) of snapshot objects to be used with
   * instances of this class.
   */
  static get _impl_snapshotClass() {
    return PropertySnapshot;
  }
}
