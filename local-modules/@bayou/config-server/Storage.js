// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { use } from '@bayou/injecty';
import { UtilityClass } from '@bayou/util-common';

/**
 * Utility functionality regarding the file / document storage system.
 */
export default class Storage extends UtilityClass {
  /**
   * {@bayou/file-store/BaseFileStore} The object which provides access to file
   * storage (roughly speaking, the filesystem to store the "files" this system
   * deals with).
   */
  static get fileStore() {
    return use.Storage.fileStore;
  }

  /**
   * Checks whether the given value is syntactically valid as a file ID.
   * This method is only ever called with a non-empty string.
   *
   * @param {string} id The (alleged) file ID to check.
   * @returns {boolean} `true` iff `id` is syntactically valid.
   */
  static isFileId(id) {
    return use.Storage.isFileId(id);
  }
}
