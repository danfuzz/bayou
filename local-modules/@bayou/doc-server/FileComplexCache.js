// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Storage } from '@bayou/config-server';
import { BaseCache } from '@bayou/weak-lru-cache';

import FileComplex from './FileComplex';

/** {Int} Maximum size of the LRU cache. */
const MAX_LRU_CACHE_SIZE = 10;

/**
 * Cache of active instances of {@link FileComplex}.
 */
export default class FileComplexCache extends BaseCache {
  /**
   * Constructs an instance.
   *
   * @param {Logger} log Logger instance to use.
   */
  constructor(log) {
    super(log, MAX_LRU_CACHE_SIZE);
  }

  /** @override */
  get _impl_cachedClass() {
    return FileComplex;
  }

  /** @override */
  _impl_idFromObject(fileComplex) {
    return fileComplex.fileAccess.documentId;
  }

  /** @override */
  _impl_isValidId(id) {
    // **Note:** This is just a surface syntax check of the ID. We don't make a
    // back-end call to check the ID here (which would have to be `async`),
    // because that would be a major waste if it turns out we're here in the
    // process of finding an already-cached object.
    return Storage.dataStore.isDocumentId(id);
  }
}
