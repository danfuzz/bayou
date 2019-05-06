// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fse from 'fs-extra';
import os from 'os';
import path from 'path';

import { Codec } from '@bayou/codec';
import { LocalFile } from '@bayou/file-store-local';
import { Codecs as fileStoreOt_TheModule } from '@bayou/file-store-ot';
import { UtilityClass } from '@bayou/util-common';

/** {Codec} Codec instance to use for `LocalFile` instances. */
const codec = new Codec();
fileStoreOt_TheModule.registerCodecs(codec.registry);

/**
 * Utility class to dole out unique temporary filesystem paths, so that the
 * various tests don't trample on each other.
 */
export class TempFiles extends UtilityClass {
  /**
   * Finishes up a test with the given file. This flushes the file and then
   * removes the directory it uses. The flushing activity notably could write
   * logs and throw errors, both of which ought to be associated with the test
   * which created the file; therefore, calls to this function are best done as
   * part of the `it()` cases and not, e.g., in an `afterEach()` block or
   * similar.
   *
   * @param {LocalFile} file File to finish up with.
   */
  static async doneWithFile(file) {
    await file.flush();

    // This is a "deep remove" a la `rm -rf`.
    await fse.remove(file.storagePath);
  }

  /**
   * Makes a new {@link LocalFile} and calls `create()` on it.
   *
   * @param {string} [fullPath = null] Path to use for the file, or `null` to
   *   have this function pick one (a unique temporary directory).
   * @returns {LocalFile} An appropriately-constructed instance.
   */
  static async makeAndCreateFile(fullPath = null) {
    const result = TempFiles.makeFile(fullPath);

    await result.create();

    return result;
  }

  /**
   * Makes a new {@link LocalFile}, without any further post-construction
   * action.
   *
   * @param {string} [fullPath = null] Path to use for the file, or `null` to
   *   have this function pick one (a unique temporary directory).
   * @returns {LocalFile} An appropriately-constructed instance.
   */
  static makeFile(fullPath = null) {
    if (fullPath === null) {
      fullPath = TempFiles.uniquePath();
    }

    const id = path.basename(fullPath);

    return new LocalFile(id, fullPath, codec);
  }

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
      TempFiles._thePrefix = fse.mkdtempSync(path.join(os.tmpdir(), 'bayou-test-'));
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
