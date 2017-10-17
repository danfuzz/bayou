// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseSnapshot, RevisionNumber } from 'doc-common';
import { TFunction } from 'typecheck';
import { Errors } from 'util-common';

import BaseComplexMember from './BaseComplexMember';

/**
 * Base class for document part controllers. There is one instance of each
 * concrete subclass of this class for each actively-edited document. They are
 * all managed and hooked up via {@link FileComplex}.
 */
export default class BaseControl extends BaseComplexMember {
  /**
   * {class} Class (constructor function) of change objects to be used with
   * instances of this class.
   */
  static get changeClass() {
    // **Note:** `this` in the context of a static method is the class, not an
    // instance.
    return this.snapshotClass.changeClass;
  }

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
   * @param {FileAccess} fileAccess Low-level file access and related
   *   miscellanea.
   */
  constructor(fileAccess) {
    super(fileAccess);
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
   * Returns a document change representing a change to the portion of the file
   * controlled by this instance which has been made with respect to a given
   * revision. This returns a promptly-resolved value when `baseRevNum` is not
   * the current revision (that is, it is an older revision); but when
   * `baseRevNum` _is_ the current revision, the return value only resolves
   * after at least one change has been made. It is an error to request a
   * revision that does not yet exist. For subclasses that don't keep full
   * history, it is also an error to request a revision that is _no longer_
   * available as a base; in this case, the error name is always
   * `revision_not_available`.
   *
   * The return value is a change instance with respect to (that is, whose base
   * revision is) the one indicated by `baseRevNum` as passed to the method.
   * That is, roughly speaking, if `snapshot[result.revNum] =
   * snapshot(baseRevNum).compose(result)`.
   *
   * @param {Int} baseRevNum Revision number for the base to get a change with
   *   respect to.
   * @returns {BaseChange} Change with respect to the revision indicated by
   *   `baseRevNum`. Always an instance of the appropriate change class as
   *   specified by the concrete subclass of this class. The result's `revNum`
   *   is guaranteed to be at least one greater than `baseRevNum` (and could
   *   possibly be even larger). The `timestamp` and `authorId` of the result
   *   will both be `null`.
   */
  async getChangeAfter(baseRevNum) {
    const currentRevNum = await this.currentRevNum();
    RevisionNumber.maxInc(baseRevNum, currentRevNum);

    const result = await this._impl_getChangeAfter(baseRevNum, currentRevNum);

    if (result === null) {
      throw Errors.revision_not_available(baseRevNum);
    }

    this.constructor.changeClass.check(result);

    if ((result.timestamp !== null) || (result.authorId !== null)) {
      throw Errors.bad_value(result, this.constructor.changeClass, 'timestamp === null && authorId === null');
    }

    return result;
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
      throw Errors.revision_not_available(revNum);
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
   * Subclass-specific implementation of `getChangeAfter()`. Subclasses must
   * override this.
   *
   * @abstract
   * @param {Int} baseRevNum Revision number for the base to get a change with
   *   respect to. Guaranteed to refer to the instantaneously-current revision
   *   or earlier.
   * @param {Int} currentRevNum The instantaneously-current revision number that
   *   was determined just before this method was called, and which should be
   *   treated as the actually-current revision number at the start of this
   *   method.
   * @returns {BaseChange|null} Change with respect to the revision indicated by
   *   `baseRevNum`, or `null` to indicate that the revision was not available
   *   as a base. If non-`null`, must be an instance of the appropriate change
   *   class as specified by the concrete subclass of this class with `null` for
   *   both `timestamp` and `authorId`.
   */
  async _impl_getChangeAfter(baseRevNum, currentRevNum) {
    return this._mustOverride(baseRevNum, currentRevNum);
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

  // **TODO:** `create()` and `update()`.
}
