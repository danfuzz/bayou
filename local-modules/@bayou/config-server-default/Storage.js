// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Ids } from '@bayou/config-common';
import { BodyDelta } from '@bayou/doc-common';
import { LocalFileStore } from '@bayou/file-store-local';
import { UtilityClass } from '@bayou/util-common';

/**
 * Utility functionality regarding the file / document storage system.
 */
export default class Storage extends UtilityClass {
  /**
   * {@bayou/doc-common/BodyDelta} Implementation of standard configuration
   * point.
   */
  static get DEFAULT_DOCUMENT_BODY() {
    return new BodyDelta([
      ['text', 'Welcome to Bayou!'],
      ['text', '\n', { header: 1 }],
      ['text', 'Now go grab a '],
      ['text', 'boat', { bold: true }],
      ['text', ' and start '],
      ['text', 'a-rowin\'', { italic: true }],
      ['text', '.\n']
    ]);
  }

  /**
   * {LocalFileStore} Implementation of standard configuration point. This
   * implementation just uses the development-oriented local-filesystem-based
   * version of the class.
   */
  static get fileStore() {
    return LocalFileStore.theOne;
  }

  /**
   * Implementation of standard configuration point.
   *
   * This implementation defers to the configured function
   * {@link @bayou/config-common/Ids#isDocumentId}.
   *
   * @param {string} id The (alleged) file ID to check.
   * @returns {boolean} `true` iff `id` is syntactically valid.
   */
  static isFileId(id) {
    return Ids.isDocumentId(id);
  }
}
