// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { StoragePath } from '@bayou/file-store-ot';
import { Errors, FrozenBuffer, UtilityClass } from '@bayou/util-common';

/**
 * Utility class for handling storage IDs. A storage ID is (generally speaking)
 * the identifier of an atomic item of data within a file. Storage IDs are all
 * strings. There are two valid kinds of storage ID:
 *
 * * paths &mdash; Storage paths as defined by {@link StoragePath}.
 * * content hashes &mdash; Content hashes as defined by
 *   {@link @bayou/util-common.FrozenBuffer}.
 */
export class StorageId extends UtilityClass {
  /**
   * Validates that the given value is a valid storage ID string. Throws an
   * error if not.
   *
   * @param {*} value Value to check.
   * @returns {string} `value` if it is in fact a valid storage ID string.
   */
  static check(value) {
    if (StorageId.isInstance(value)) {
      return value;
    }

    throw Errors.badValue(value, StorageId);
  }

  /**
   * Checks or converts a hash value. If given a valid hash value, returns it.
   * Otherwise, the given value must be a `FrozenBuffer`, and its hash is
   * returned. Throws an error in all other cases.
   *
   * @param {string|FrozenBuffer} hashOrBuffer The value in question.
   * @returns {string} The given value if it is in fact a valid hash string, or
   *   the hash of the given `FrozenBuffer` value if not.
   */
  static checkOrGetHash(hashOrBuffer) {
    if (hashOrBuffer instanceof FrozenBuffer) {
      return hashOrBuffer.hash;
    }

    return FrozenBuffer.checkHash(hashOrBuffer);
  }

  /**
   * Indicates whether the given value is a valid storage ID string.
   *
   * @param {*} value Value in question.
   * @returns {boolean} `true` if `value` is indeed a valid storage ID string,
   *   or `false` if not.
   */
  static isInstance(value) {
    return StoragePath.isInstance(value) || FrozenBuffer.isHash(value);
  }
}
