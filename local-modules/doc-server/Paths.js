// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { RevisionNumber } from 'doc-common';

/**
 * Utility class that just provides the common `StoragePath` strings used
 * by the document storage format.
 */
export default class Paths {
  /** {string} `StoragePath` string for the document format version. */
  static get FORMAT_VERSION() {
    return '/format_version';
  }

  /** {string} `StoragePath` string for the document version number. */
  static get VERSION_NUMBER() {
    return '/version_number';
  }

  /**
   * Gets the `StoragePath` string corresponding to the indicated version
   * number, specifically to store the document change that results in that
   * version.
   *
   * @param {RevisionNumber} verNum The version number.
   * @returns {string} The corresponding `StoragePath` string.
   */
  static forVerNum(verNum) {
    RevisionNumber.check(verNum);
    return `/change/${verNum}`;
  }
}
