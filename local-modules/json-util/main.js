// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * JSON helper utilities.
 */
export default class JsonUtil {
  /**
   * Like `JSON.parse()`, except the result is always deep-frozen.
   */
  static parseFrozen(text) {
    return JSON.parse(text, (key_unused, value) => {
      return (typeof value === 'object')
        ? Object.freeze(value)
        : value
    });
  }
}
