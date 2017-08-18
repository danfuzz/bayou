// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TArray, TString, TypeError } from 'typecheck';
import { UtilityClass } from 'util-common';

/**
 * {RegEx} Regular expression which passes for all valid path component strings.
 */
const COMPONENT_REGEX = /^[a-zA-Z0-9_]+$/;

/**
 * {RegEx} Regular expression which passes for all valid path strings.
 */
const PATH_REGEX = /^(\/[a-zA-Z0-9_]+)+$/;

/**
 * Utility class for handling storage paths. A storage path is a
 * hierarchical-filesystem-like path which provides a stable name for a chunk of
 * data within a file. A valid path is a string consisting of one or more
 * components, where each component is a slash (`/`) followed by a sequence of
 * one or more characters in the usual "identifier" set (`[a-zA-Z0-9_]`).
 *
 * * Example path: `/foo_1/bar/baz/23`
 * * Example component: `puffin_biscuit_7`
 */
export default class StoragePath extends UtilityClass {
  /**
   * Gets all the prefixes of the given storage path, where each prefix names
   * a "superdirectory" that the original `path` can be considered to be in.
   * The return value is in super- to sub-directory order.
   *
   * **Note:** This returns an empty array (`[]`) if given a single-component
   * path (e.g. `/foo`).
   *
   * @param {string} path Storage path.
   * @returns {array<string>} List of all prefixes that "lead" to `path`.
   */
  static allPrefixes(path) {
    const components = StoragePath.split(path);
    const result = [];
    let soFar = '';

    // Pop off the final component, as including it would end up with the full
    // path as the last element of the result (and that would be wrong per the
    // method's contract.)
    components.pop();

    for (const c of components) {
      soFar += `/${c}`;
      result.push(soFar);
    }

    return result;
  }

  /**
   * Validates that the given value is a valid storage path string. Throws an
   * error if not.
   *
   * @param {*} value Value to check.
   * @returns {string} `value` if it is in fact a valid storage path string.
   */
  static check(value) {
    TString.nonempty(value);

    if (!PATH_REGEX.test(value)) {
      return TypeError.badValue(value, 'StoragePath');
    }

    return value;
  }

  /**
   * Validates that the given value is a valid storage path component. Throws an
   * error if not. Components are as defined in the class-level documentation
   * and notably must _not_ contain any slashes (`/`).
   *
   * @param {*} value Value to check.
   * @returns {string} `value` if it is in fact a valid storage path component.
   */
  static checkComponent(value) {
    TString.nonempty(value);

    if (!COMPONENT_REGEX.test(value)) {
      return TypeError.badValue(value, 'StoragePath component');
    }

    return value;
  }

  /**
   * Indicates whether the first path is a prefix of the second. In filesystem
   * terms, this indicates whether the first path names a directory above the
   * second path.
   *
   * @param {string} prefix Path prefix.
   * @param {string} path Path which might start with `prefix`.
   * @returns {boolean} `true` if `prefix` is indeed a path prefix of `path`, or
   *   `false` if not.
   */
  static isPrefix(prefix, path) {
    StoragePath.check(prefix);
    StoragePath.check(path);

    return path.startsWith(`${prefix}/`);
  }

  /**
   * Joins an array of components into a single storage path string. Components
   * must _not_ include slashes (`/`). This operation is the inverse of
   * `split()`.
   *
   * @param {array<string>} components Array of path components.
   * @returns {string} Unified storage path of all the `components`.
   */
  static join(components) {
    TArray.check(components, StoragePath.checkComponent);
    return `/${components.join('/')}`;
  }

  /**
   * Validates that the given value is either a valid storage path string or
   * `null`. Throws an error if not.
   *
   * @param {*} value Value to check.
   * @returns {string} `value` if it is in fact a valid storage path string.
   */
  static orNull(value) {
    if (value === null) {
      return value;
    }

    try {
      return StoragePath.check(value);
    } catch (e) {
      // More specific error.
      return TypeError.badValue(value, 'StoragePath|null');
    }
  }

  /**
   * Splits a storage path into individual components. Resulting components are
   * just the names and do not contain any slash separators. This operation is
   * the inverse of `join()`.
   *
   * @param {string} path Storage path.
   * @returns {array<string>} Array consisting of the components of `path`.
   */
  static split(path) {
    StoragePath.check(path);

    // Slice off the initial `/`, because otherwise the first element of the
    // result is an empty string.
    return path.slice(1).split('/');
  }
}
