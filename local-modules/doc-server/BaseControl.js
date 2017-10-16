// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { RevisionNumber } from 'doc-common';

import BaseComplexMember from './BaseComplexMember';

/**
 * Base class for document part controllers. There is one instance of each
 * concrete subclass of this class for each actively-edited document. They are
 * all managed and hooked up via {@link FileComplex}.
 */
export default class BaseControl extends BaseComplexMember {
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
   * Subclass-specific implementation of `currentRevNum()`. Subclasses must
   * override this.
   *
   * @abstract
   * @returns {Int} The instantaneously-current revision number.
   */
  async _impl_currentRevNum() {
    return this._mustOverride();
  }

  // **TODO:** Eventually this class will have the base versions of things like
  // `snapshot()` and `getChangeAfter()`.
}
