// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CaretId } from '@bayou/doc-common';
import { BaseCache } from '@bayou/weak-lru-cache';

import DocSession from './DocSession';

/**
 * Cache of active instances of {@link DocSession}.
 */
export default class SessionCache extends BaseCache {
  /**
   * Constructs an instance.
   *
   * @param {Logger} log Logger instance to use.
   */
  constructor(log) {
    super(log.withAddedContext('session'));
  }

  /** @override */
  get _impl_cachedClass() {
    return DocSession;
  }

  /** @override */
  get _impl_maxLruSize() {
    return 10;
  }

  /** @override */
  get _impl_maxRejectionAge() {
    // Valid value so that the constructor won't complain, but note that this
    // class isn't used asynchronously, so the actual value shouldn't matter.
    return 1000;
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
