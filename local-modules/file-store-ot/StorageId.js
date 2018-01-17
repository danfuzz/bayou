// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { StoragePath } from 'file-store-ot';
import { Errors, FrozenBuffer, UtilityClass } from 'util-common';

/**
 * Utility class for handling storage IDs. A storage ID is (generally speaking)
 * the identifier of an atomic item of data within a file. Storage IDs are all
 * strings. There are two valid kinds of storage ID:
 *
 * * paths &mdash; Storage paths as defined by {@link StoragePath}.
 * * content hashes &mdash; Content hashes as defined by
 *   {@link util-common.FrozenBuffer}.
 */
export default class StorageId extends UtilityClass {
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
