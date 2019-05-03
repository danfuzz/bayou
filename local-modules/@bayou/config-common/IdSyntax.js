// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { use } from '@bayou/injecty';

import { BaseIdSyntax } from './BaseIdSyntax';

/**
 * Utility functionality regarding ID strings.
 */
export class IdSyntax extends BaseIdSyntax {
  /**
   * Checks whether the given value is syntactically valid as an author ID.
   * This method is only ever called with a non-empty string.
   *
   * @param {string} id The (alleged) author ID to check.
   * @returns {boolean} `true` iff `id` is syntactically valid.
   */
  static isAuthorId(id) {
    return use.IdSyntax.isAuthorId(id);
  }

  /**
   * Checks whether the given value is syntactically valid as a document ID.
   * This method is only ever called with a non-empty string.
   *
   * @param {string} id The (alleged) document ID to check.
   * @returns {boolean} `true` iff `id` is syntactically valid.
   */
  static isDocumentId(id) {
    return use.IdSyntax.isDocumentId(id);
  }
}
