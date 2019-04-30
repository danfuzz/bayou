// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { use } from '@bayou/injecty';
import { UtilityClass } from '@bayou/util-common';

/**
 * Utility functionality regarding the file / document storage system.
 */
export default class Storage extends UtilityClass {
  /**
   * {@bayou/doc-common/BodyDelta} The body content to use for new documents.
   */
  static get DEFAULT_DOCUMENT_BODY() {
    return use.Storage.DEFAULT_DOCUMENT_BODY;
  }

  /**
   * {@BaseDocStore} Provider of access to the basic "document store" of the
   * underlying system, for everything other than file storage (the latter which
   * is handled by {@link #fileStore}). This includes information such as what
   * users and documents exist, whether IDs (beyond being syntactically valid)
   * are valid in the context of the rest of the data stored by the system, and
   * so on.
   */
  static get docStore() {
    return use.Storage.docStore;
  }

  /**
   * {@bayou/file-store/BaseFileStore} The object which provides access to file
   * storage (roughly speaking, the filesystem to store the "files" this system
   * deals with).
   */
  static get fileStore() {
    return use.Storage.fileStore;
  }
}
