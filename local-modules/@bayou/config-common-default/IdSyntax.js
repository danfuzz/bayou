// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { DefaultIdSyntax } from '@bayou/doc-id-default';
import { BaseIdSyntax } from '@bayou/config-common';

/**
 * Utility functionality regarding ID strings. This implementation uses the
 * default definitions provided by {@link @bayou/doc-id-default}.
 */
export default class IdSyntax extends BaseIdSyntax {
  /**
   * Implementation of standard configuration point.
   *
   * @param {string} id The (alleged) author ID to check.
   * @returns {boolean} `true` iff `id` is syntactically valid.
   */
  static isAuthorId(id) {
    return DefaultIdSyntax.isAuthorId(id);
  }

  /**
   * Implementation of standard configuration point.
   *
   * @param {string} id The (alleged) document ID to check.
   * @returns {boolean} `true` iff `id` is syntactically valid.
   */
  static isDocumentId(id) {
    return DefaultIdSyntax.isDocumentId(id);
  }
}
