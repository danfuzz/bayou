// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * Character set used for ID strings. This is the set of visually (and mostly
 * audibly) unambiguous alphanumerics.
 */
const ID_CHARS = 'abcdefghjkmnpqrstvwxyz23456789';

/**
 * Constructor of random ID strings. These are _not_ meant to be _guaranteed_
 * unique, just _typically_ unique for the specific purpose of logging.
 */
export default class RandomId {
  /**
   * Constructs a random ID string with the indicated tag prefix.
   *
   * @param prefix The prefix.
   * @returns The constructed string.
   */
  static make(prefix) {
    let result = `${prefix}-`;

    for (let i = 0; i < 8; i++) {
      result += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
    }

    return result;
  }
}
