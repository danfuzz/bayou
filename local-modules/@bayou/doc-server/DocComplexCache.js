// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Storage } from '@bayou/config-server';
import { BaseCache } from '@bayou/weak-lru-cache';

import { DocComplex } from './DocComplex';

/**
 * Cache of active instances of {@link DocComplex}.
 */
export class DocComplexCache extends BaseCache {
  /**
   * Constructs an instance.
   *
   * @param {Logger} log Logger instance to use.
   */
  constructor(log) {
    super(log);
  }

  /** @override */
  get _impl_cachedClass() {
    return DocComplex;
  }

  /** @override */
  get _impl_maxLruSize() {
    return 10;
  }

  /** @override */
  get _impl_maxRejectionAge() {
    return 10 * 1000; // Ten seconds.
  }

  /** @override */
  _impl_idFromObject(docComplex) {
    return docComplex.fileAccess.documentId;
  }

  /** @override */
  _impl_isValidId(id) {
    // **Note:** This is just a surface syntax check of the ID. We don't make a
    // back-end call to check the ID here (which would have to be `async`),
    // because that would be a major waste if it turns out we're here in the
    // process of finding an already-cached object.
    return Storage.docStore.isDocumentId(id);
  }
}
