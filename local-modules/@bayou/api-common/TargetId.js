// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from '@bayou/typecheck';
import { Errors, UtilityClass } from '@bayou/util-common';

/** {RegExp} Regular expression which matches valid target IDs. */
const VALID_TARGET_ID_REGEX = /^[-_.a-zA-Z0-9]{1,64}$/;

/**
 * Type representation of target IDs. The values themselves are always just
 * strings. This is just where the type checker code lives.
 *
 * A "target ID" is a string identifier which "names" an object at an API
 * boundary. There are both "well-known" IDs (most notably `meta`) as well as
 * programatically-generated IDs (e.g. for specific files).
 *
 * Syntactically, a target ID must be a string of consisting of ASCII-range
 * alphanumerics, underscore (`_`), dash (`-`), or period (`.`), which is at
 * least one and no longer than 64 characters.
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
}
