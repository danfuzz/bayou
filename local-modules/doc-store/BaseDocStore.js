// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Typecheck from 'typecheck';

import BaseDoc from './BaseDoc';

/**
 * Base class for document storage access. Subclasses must override several
 * methods defined by this class, as indicated in the documentation.
 */
export default class BaseDocStore {
  /**
   * Gets the accessor for the document with the given ID. The document need not
   * exist prior to calling this method.
   *
   * @param {string} docId The ID of the document to access. Must be a nonempty
   *   string.
   * @returns {BaseDoc} Accessor for the document in question.
   */
  getDocument(docId) {
    Typecheck.stringNonempty(docId);
    this._impl_checkDocId(docId);
    return Typecheck.instance(this._impl_getDocument(docId), BaseDoc);
  }

  /**
   * Checks a document ID for validity. Returns regularly (with no value) if
   * all is well, or throws an error if the ID is invalid. Only ever called on
   * a non-empty string.
   *
   * This implementation is a no-op. Subclasses may choose to override this if
   * there is more syntax to their document IDs.
   *
   * @param {string} docId_unused The document ID to validate.
   */
  _impl_checkDocId(docId_unused) {
    // This space intentionally left blank.
  }

  /**
   * Helper for `getDocument()`. Only ever called with a known-valid `docId`.
   *
   * **Note:** This method must be overridden by subclasses.
   *
   * @param {string} docId The ID of the document to access.
   * @returns {BaseDoc} Accessor for the document in question.
   */
  _impl_getDocument(docId) {
    return this._mustOverride(docId);
  }

  /**
   * Helper function which always throws. Using this both documents the intent
   * in code and keeps the linter from complaining about the documentation
   * (`@param`, `@returns`, etc.).
   *
   * @param {...*} args_unused Anything you want, to keep the linter happy.
   */
  _mustOverride(...args_unused) {
    throw new Error('Must override.');
  }
}
