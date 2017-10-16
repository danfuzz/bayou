// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseSnapshot, RevisionNumber } from 'doc-common';
import { TFunction } from 'typecheck';
import { InfoError } from 'util-common';

import BaseComplexMember from './BaseComplexMember';

/**
 * Base class for document part controllers. There is one instance of each
 * concrete subclass of this class for each actively-edited document. They are
 * all managed and hooked up via {@link FileComplex}.
 */
export default class BaseControl extends BaseComplexMember {
  /**
   * {class} Class (constructor function) of snapshot objects to be used with
   * instances of this class.
   */
  static get snapshotClass() {
    // **Note:** `this` in the context of a static method is the class, not an
    // instance.

    if (!this._snapshotClass) {
      // Call the `_impl` and verify the result.
      const clazz = this._impl_snapshotClass;

      TFunction.checkClass(clazz, BaseSnapshot);
      this._snapshotClass = clazz;
    }

    return this._snapshotClass;
  }

  /**
   * Constructs an instance.
   *
   * @param {FileComplex} fileComplex File complex that this instance is part
   *   of.
   */
  constructor(fileComplex) {
    super(fileComplex);
  }

  /**
   * Gets the instantaneously-current revision number of the portion of the file
   * controlled by this instance. It is an error to call this on an
   * uninitialized document (e.g., when the underlying file is empty).
   *
   * **Note:** Due to the asynchronous nature of the system, the value returned
   * here could be out-of-date by the time it is received by the caller. As
   * such, even when used promptly, it should not be treated as "definitely
   * current" but more like "probably current but possibly just a lower bound."
   *
   * @returns {Int} The instantaneously-current revision number.
   */
  async currentRevNum() {
    // This method merely exists to enforce the return-type contract as
    // specified in the method docs.

    const revNum = await this._impl_currentRevNum();

    return RevisionNumber.check(revNum);
  }

  /**
   * Gets a snapshot of the full contents of the portion of the file controlled
   * by this instance. It is an error to request a revision that does not yet
   * exist. For subclasses that don't keep full history, it is also an error to
   * request a revision that is _no longer_ available; in this case, the error
   * name is always `revision_not_available`.
   *
   * @param {Int|null} revNum Which revision to get. If passed as `null`,
   *   indicates the current (most recent) revision. **Note:** Due to the
   *   asynchronous nature of the system, when passed as `null` the resulting
   *   revision might already have been superseded by the time it is returned to
   *   the caller.
   * @returns {BaseSnapshot} Snapshot of the indicated revision. Always an
   *   instance of the concrete snapshot type appropriate for this instance.
   */
  async getSnapshot(revNum = null) {
    const currentRevNum = await this.currentRevNum();
    revNum = (revNum === null)
      ? currentRevNum
      : RevisionNumber.maxInc(revNum, currentRevNum);

    const result = await this._impl_getSnapshot(revNum);

    if (result === null) {
      throw new InfoError('revision_not_available', revNum);
    }

    return this.constructor.snapshotClass.check(result);
  }

  /**
   * {class} Class (constructor function) of snapshot objects to be used with
   * instances of this class. Subclasses must fill this in.
   *
   * @abstract
   */
  static get _impl_snapshotClass() {
    return this._mustOverride();
  }

  /**
   * Subclass-specific implementation of `currentRevNum()`. Subclasses must
   * override this.
   *
   * @abstract
   * @returns {Int} The instantaneously-current revision number.
   */
  async _impl_currentRevNum() {
    return this._mustOverride();
  }

  /**
   * Subclass-specific implementation of `getSnapshot()`. Subclasses must
   * override this.
   *
   * @abstract
   * @param {Int} revNum Which revision to get. Guaranteed to be a revision
   *   number for the instantaneously-current revision or earlier.
   * @returns {BaseSnapshot|null} Snapshot of the indicated revision. Must
   *   either be an instance of the concrete snapshot type appropriate for this
   *   instance or `null`. `null` specifically indicates that `revNum` is a
   *   revision older than what this instance can provide.
   */
  async _impl_getSnapshot(revNum) {
    return this._mustOverride(revNum);
  }

  // **TODO:** `create()`, `getChangeAfter()`, and `update()`.
}
