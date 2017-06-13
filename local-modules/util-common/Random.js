// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import secureRandom from 'secure-random';

import { TInt } from 'typecheck';
import { UtilityClass } from 'util-common-base';

import DataUtil from './DataUtil';

/**
 * Character set used for ID strings. This is intended to be the set of 32 most
 * visually and audibly unambiguous alphanumerics.
 */
const ID_CHARS = 'abcdefghjkmnpqrstuwxyz0123456789';

/**
 * Random number utilities. All values are generated using a cryptographically
 * secure random number generator.
 *
 * **Note:** This class uses the `secure-random` module as its interface to the
 * platform's RNG. That module works both in client and server environments,
 * using appropriate underlying facilities in each.
 */
export default class Random extends UtilityClass {
  /**
   * Gets a random byte value (range `0` to `255` inclusive).
   *
   * @returns {Int} The byte.
   */
  static byte() {
    return secureRandom(1)[0];
  }

  /**
   * Returns an array of random bytes, of a given length.
   *
   * @param {Int} length Desired length.
   * @returns {Array<Int>} Array of `length` random bytes.
   */
  static byteArray(length) {
    return secureRandom(TInt.min(length, 0));
  }

  /**
   * Returns a string of random hex digits (lower case), of a given length of
   * _bytes_. That is, the string length will be twice the given `length`.
   *
   * @param {Int} length Desired length of bytes.
   * @returns {string} String of `length * 2` random hexadecimal characters.
   */
  static hexByteString(length) {
    const bytes = Random.byteArray(length);
    return DataUtil.hexFromBytes(bytes);
  }

  /**
   * Constructs a short label string with the indicated tag prefix. These are
   * _typically_ but not _guaranteed_ to be unique and are intended to aid in
   * disambiguating logs (and not for anything deeper).
   *
   * @param {string} prefix The prefix.
   * @returns {string} The constructed random ID string.
   */
  static shortLabel(prefix) {
    let result = `${prefix}-`;

    for (let i = 0; i < 8; i++) {
      result += ID_CHARS[Random.byte() % ID_CHARS.length];
    }

    return result;
  }
}
