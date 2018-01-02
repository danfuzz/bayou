// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';
import { Errors, UtilityClass } from 'util-common';

/** {RegExp} Regular expression which matches valid target IDs. */
const VALID_TARGET_ID_REGEX = /^[-_a-zA-Z0-9]{1,64}$/;

/**
 * Type representation of target IDs. The values themselves are always just
 * strings. This is just where the type checker code lives.
 *
 * A "target ID" is a string identifier which "names" an object at an API
 * boundary. There are both "well-known" IDs (most notably `meta`) as well as
 * programatically-generated IDs (e.g. for specific files).
 *
 * Syntactically, a target ID must be a string of consisting of ASCII-range
 * alphanumerics, underscore (`_`), or dash (`-`), which is no longer than 64
 * characters.
 */
export default class TargetId extends UtilityClass {
  /**
   * Checks a value of type `TargetId`.
   *
   * @param {*} value Value to check.
   * @returns {string} `value`.
   */
  static check(value) {
    try {
      return TString.check(value, VALID_TARGET_ID_REGEX);
    } catch (e) {
      // Throw a higher-fidelity error.
      throw Errors.badValue(value, TargetId);
    }
  }

  /**
   * Checks a value of type `TargetId` which must furthermore have a minimum
   * length as given.
   *
   * @param {*} value Value to check.
   * @param {Int} minLen The minimum length.
   * @returns {string} `value`.
   */
  static minLen(value, minLen) {
    try {
      TString.check(value, VALID_TARGET_ID_REGEX);
      TString.minLen(value, minLen);
      return value;
    } catch (e) {
      // Throw a higher-fidelity error.
      throw Errors.badValue(value, TargetId, `length >= ${minLen}`);
    }
  }
}
