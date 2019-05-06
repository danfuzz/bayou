// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from '@bayou/typecheck';
import { UtilityClass } from '@bayou/util-common';

/**
 * {RexExp} Expression which is used to match all of the ID types.
 *
 * **TODO:** Consider using prefixes on each ID by type (e.g., `file-`), just so
 * that they're unambiguous. Might help catch some bugs.
 */
const ID_REGEX = /^[-_a-zA-Z0-9]{1,32}$/;

/**
 * Default ID syntax definitions. See module `README.md` for more details.
 */
export class DefaultIdSyntax extends UtilityClass {
  /**
   * Default implementation of author ID syntax checking.
   *
   * This implementation requires that author IDs have no more than 32
   * characters and only use ASCII alphanumerics plus dash (`-`) and underscore
   * (`_`).
   *
   * @param {string} id The (alleged) author ID to check.
   * @returns {boolean} `true` iff `id` is syntactically valid.
   */
  static isAuthorId(id) {
    TString.check(id);

    return ID_REGEX.test(id);
  }

  /**
   * Default implementation of document ID syntax checking.
   *
   * This implementation requires that document IDs have no more than 32
   * characters and only use ASCII alphanumerics plus dash (`-`) and underscore
   * (`_`).
   *
   * @param {string} id The (alleged) document ID to check.
   * @returns {boolean} `true` iff `id` is syntactically valid.
   */
  static isDocumentId(id) {
    TString.check(id);

    return ID_REGEX.test(id);
  }

  /**
   * Default implementation of file ID syntax checking.
   *
   * This implementation requires that file IDs have no more than 32
   * characters and only use ASCII alphanumerics plus dash (`-`) and underscore
   * (`_`).
   *
   * @param {string} id The (alleged) file ID to check.
   * @returns {boolean} `true` iff `id` is syntactically valid.
   */
  static isFileId(id) {
    TString.check(id);

    return ID_REGEX.test(id);
  }
}
