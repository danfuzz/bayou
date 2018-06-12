// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Storage } from '@bayou/config-server';
import { Errors, UtilityClass } from '@bayou/util-common';

/**
 * Type representation of file IDs. The values themselves are always just
 * strings. This is just where the type checker code lives.
 *
 * At a minimum a file ID has to be a non-empty string. Beyond that, the
 * required syntax is determined via `@bayou/hooks-server`.
 *
 * **Note:** By default, the syntax for a file ID is the same as that for a
 * document ID. Furthermore, document IDs are generally passed as-is to become
 * file IDs. That said, there are salient differences:
 *
 * * File IDs are a server-only concept.
 * * It is possible (though not as of this writing done) for there to be files
 *   in the system that do _not_ correspond to exposed documents.
 */
export default class FileId extends UtilityClass {
  /**
   * Checks a value of type `FileId`.
   *
   * @param {*} value Value to check.
   * @returns {string} `value`.
   */
  static check(value) {
    if (   (typeof value !== 'string')
        || (value.length === 0)
        || !Storage.isFileId(value)) {
      throw Errors.badValue(value, FileId);
    }

    return value;
  }
}
