// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Hooks } from 'hooks-common';
import { TypeError } from 'typecheck';

/**
 * Type representation of document IDs. The values themselves are always just
 * strings. This is just where the type checker code lives.
 *
 * At a minimum a document ID has to be a non-empty string. Beyond that, the
 * required syntax is determined via `hooks-common`.
 */
export default class DocumentId {
  /**
   * Checks a value of type `DocumentId`.
   *
   * @param {*} value Value to check.
   * @returns {string} `value`.
   */
  static check(value) {
    if (   (typeof value !== 'string')
        || (value.length === 0)
        || !Hooks.isDocumentId(value)) {
      return TypeError.badValue(value, 'DocumentId');
    }

    return value;
  }
}
