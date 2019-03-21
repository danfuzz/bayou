// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseCache } from '@bayou/weak-lru-cache';

import BaseFile from './BaseFile';

/** {Int} Maximum size of the LRU cache. */
const MAX_LRU_CACHE_SIZE = 10;

/**
 * Cache of active instances of {@link BaseFile}.
 */
export default class FileCache extends BaseCache {
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
    return BaseFile;
  }

  /** @override */
  _impl_idFromObject(file) {
    return file.id;
  }

  /** @override */
  _impl_isValidId(id_unused) {
    // **TODO:** Consider plumbing through an actual ID syntax checker.
    return true;
  }
}
