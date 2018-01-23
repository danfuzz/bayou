// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import os from 'os';
import path from 'path';

import { UtilityClass } from 'util-common';

/**
 * Utility class to dole out unique temporary filesystem paths, so that the
 * various tests don't trample on each other.
 */
export default class TempFiles extends UtilityClass {
  /**
   * Makes a new unique temporary path.
   *
   * @returns {string} Full path, including a unique numeric index.
   */
  static uniquePath() {
    const prefix = TempFiles._prefix;
    const id     = TempFiles._nextId();

    return path.join(prefix, `test-${id}`);
  }

  /** {string} The directory prefix to use for all paths. */
  static get _prefix() {
    if (!TempFiles._thePrefix) {
      TempFiles._thePrefix = fs.mkdtempSync(path.join(os.tmpdir(), 'bayou-test-'));
    }

    return TempFiles._thePrefix;
  }

  /**
   * Gets the next unique ID to use.
   *
   * @returns {Int} The ID.
   */
  static _nextId() {
    const result = TempFiles._theId || 0;

    TempFiles._theId = result + 1;
    return result;
  }
}
