// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CaretId } from '@bayou/doc-common';
import { BaseCache } from '@bayou/weak-lru-cache';

import DocSession from './DocSession';

/** {Int} Maximum size of the LRU cache. */
const MAX_LRU_CACHE_SIZE = 10;

/**
 * Cache of active instances of {@link DocSession}.
 */
export default class DocSessionCache extends BaseCache {
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
    return DocSession;
  }

  /** @override */
  _impl_idFromObject(session) {
    return session.getCaretId();
  }

  /** @override */
  _impl_isValidId(id) {
    return CaretId.isInstance(id);
  }
}
