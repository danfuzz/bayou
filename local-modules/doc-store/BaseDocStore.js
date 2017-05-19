// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';
import { Singleton } from 'util-common';

import BaseDoc from './BaseDoc';

/**
 * Base class for document storage access. Subclasses must override several
 * methods defined by this class, as indicated in the documentation. Methods to
 * override are all named with the prefix `_impl_`.
 *
 * **Note:** This is a subclass of `Singleton`, that is, the system is set up
 * to only ever expect there to be one document store instance. (Technically,
 * this inheritence relationship allows for the possibility of having singleton
 * instances of several subclasses of this class, but in practice that's not
 * what happens.)
 */
export default class BaseDocStore extends Singleton {
  /**
   * Checks a document ID for validity. Returns regularly (with no value) if
   * all is well, or throws an error if the ID is invalid. Only ever called on
   * a non-empty string.
   *
   * This implementation is a no-op. Subclasses may choose to override this if
   * there is more syntax and/or semantics to their document IDs.
   *
   * @param {string} docId_unused The document ID to validate.
   */
  _impl_checkDocId(docId_unused) {
    // This space intentionally left blank.
  }

  /**
   * Gets the accessor for the document with the given ID. The document need not
   * exist prior to calling this method.
   *
   * @param {string} docId The ID of the document to access. Must be a nonempty
   *   string.
   * @returns {BaseDoc} Accessor for the document in question.
   */
  getDocument(docId) {
    TString.nonempty(docId);
    this._impl_checkDocId(docId);
    return BaseDoc.check(this._impl_getDocument(docId));
  }

  /**
   * Main implementation of `getDocument()`. Only ever called with a known-valid
   * `docId`.
   *
   * **Note:** This method must be overridden by subclasses.
   *
   * @param {string} docId The ID of the document to access.
   * @returns {BaseDoc} Accessor for the document in question.
   */
  _impl_getDocument(docId) {
    return this._mustOverride(docId);
  }
}
