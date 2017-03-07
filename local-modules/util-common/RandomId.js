// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import secureRandom from 'secure-random';

/**
 * Character set used for ID strings. This is intended to be the set of 32 most
 * visually and audibly unambiguous alphanumerics.
 */
const ID_CHARS = 'abcdefghjkmnpqrstvwxyz0123456789';

/**
 * Constructor of random ID strings. These are _not_ meant to be _guaranteed_
 * unique, just _typically_ unique for the specific purpose of logging.
 */
export default class RandomId {
  /**
   * Constructs a random ID string with the indicated tag prefix.
   *
   * @param {string} prefix The prefix.
   * @returns {string} The constructed random ID string.
   */
  static make(prefix) {
    let result = `${prefix}-`;

    for (let i = 0; i < 8; i++) {
      result += ID_CHARS[Math.floor(RandomId.byte() % ID_CHARS.length)];
    }

    return result;
  }

  /**
   * Gets a random byte value (range `0` to `255` inclusive).
   *
   * @returns {Int} The byte.
   */
  static byte() {
    return secureRandom(1)[0];
  }
}
