// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BodyDelta } from '@bayou/doc-common';
import { DefaultDocStore } from '@bayou/doc-id-default';
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
   * {DefaultDocStore} Implementation of standard configuration point.
   */
  static get dataStore() {
    if (this._dataStore === undefined) {
      /** {DefaultDocStore} Unique instance of this class. */
      this._dataStore = new DefaultDocStore();
    }

    return this._dataStore;
  }

  /**
   * {LocalFileStore} Implementation of standard configuration point. This
   * implementation just uses the development-oriented local-filesystem-based
   * version of the class.
   */
  static get fileStore() {
    if (this._fileStore === undefined) {
      /** {LocalFileStore} Unique instance of this class. */
      this._fileStore = new LocalFileStore();
    }

    return this._fileStore;
  }
}
