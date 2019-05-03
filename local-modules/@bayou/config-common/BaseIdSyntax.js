// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { use } from '@bayou/injecty';
import { TString } from '@bayou/typecheck';
import { Errors, UtilityClass } from '@bayou/util-common';

/**
 * Base class for {@link IdSyntax} (in this module) and its configured
 * implementations.
 */
export class BaseIdSyntax extends UtilityClass {
  /**
   * Checks whether the given value is syntactically valid as an author ID.
   *
   * @param {*} value The (alleged) author ID to check.
   * @returns {string} `value` if it is valid.
   * @throws {Error} Thrown if `value` is invalid.
   */
  static checkAuthorId(value) {
    try {
      TString.check(value);
      if (this.isAuthorId(value)) {
        return value;
      }
    } catch (e) {
      // Fall through to throw higher-fidelity error.
    }

    throw Errors.badValue(value, String, 'author ID syntax');
  }

  /**
   * Checks whether the given value is either syntactically valid as an author
   * ID or is `null`.
   *
   * @param {*} value The (alleged) author ID to check.
   * @returns {string|null} `value` if it is valid or `null`.
   * @throws {Error} Thrown if `value` is invalid and not `null`.
   */
  static checkAuthorIdOrNull(value) {
    if (value === null) {
      return null;
    }

    try {
      TString.check(value);
      if (this.isAuthorId(value)) {
        return value;
      }
    } catch (e) {
      // Fall through to throw higher-fidelity error.
    }

    throw Errors.badValue(value, 'String|null', 'author ID syntax');
  }

  /**
   * Checks whether the given value is syntactically valid as a document ID.
   *
   * @param {*} value The (alleged) document ID to check.
   * @returns {string} `value` if it is valid.
   * @throws {Error} Thrown if `value` is invalid.
   */
  static checkDocumentId(value) {
    try {
      TString.check(value);
      if (this.isDocumentId(value)) {
        return value;
      }
    } catch (e) {
      // Fall through to throw higher-fidelity error.
    }

    throw Errors.badValue(value, String, 'document ID syntax');
  }

  /**
   * Indicates whether the given value is syntactically valid as an author ID.
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
