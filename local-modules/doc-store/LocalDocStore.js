// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import BaseDocStore from './BaseDocStore';
import LocalDoc from './LocalDoc';

/**
 * Document storage implementation that keeps everything in memory.
 */
export default class LocalDocStore extends BaseDocStore {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {string} docId The ID of the document to access.
   * @returns {BaseDoc} Accessor for the document in question.
   */
  _impl_getDocument(docId) {
    return new LocalDoc(docId);
  }
}
