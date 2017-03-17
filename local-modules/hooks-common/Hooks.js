// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * Hooks for common client and server needs. This is meant to make it easy for
 * complete products to customize Bayou without overlaying the original
 * source...except for this file (and other similar ones).
 */
export default class Hooks {
  /**
   * Checks whether the given value is syntactically valid as an author ID.
   * This method is only ever called with a non-empty string.
   *
   * The default implementation of this method requires that author IDs have
   * no more than 32 characters and only use ASCII alphanumerics plus dash (`-`)
   * and underscore (`_`).
   *
   * @param {string} id The (alleged) author ID to check.
   * @returns {boolen} `true` iff `id` is syntactically valid.
   */
  static isAuthorId(id) {
    return /^[-_a-zA-Z0-9]{1,32}$/.test(id);
  }

  /**
   * Checks whether the given value is syntactically valid as a document ID.
   * This method is only ever called with a non-empty string.
   *
   * The default implementation of this method requires that document IDs have
   * no more than 32 characters and only use ASCII alphanumerics plus dash (`-`)
   * and underscore (`_`).
   *
   * @param {string} id The (alleged) author ID to check.
   * @returns {boolen} `true` iff `id` is syntactically valid.
   */
  static isDocumentId(id) {
    return /^[-_a-zA-Z0-9]{1,32}$/.test(id);
  }
}
