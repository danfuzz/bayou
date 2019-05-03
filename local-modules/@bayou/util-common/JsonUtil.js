// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { UtilityClass } from '@bayou/util-core';

/**
 * JSON helper utilities.
 */
export class JsonUtil extends UtilityClass {
  /**
   * Like `JSON.parse()`, except the result is always deep-frozen.
   *
   * @param {string} text JSON source text.
   * @returns {*} Parsed JSON value.
   */
  static parseFrozen(text) {
    return JSON.parse(text, (key_unused, value) => {
      return (typeof value === 'object')
        ? Object.freeze(value)
        : value;
    });
  }
}
