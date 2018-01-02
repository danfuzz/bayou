// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// **Note:** Webpack's browser polyfill includes a Node-compatible `crypto`
// module, which is why this is possible to import regardless of environment.
import crypto from 'crypto';

import { TInt } from 'typecheck';
import { UtilityClass } from 'util-core';

/**
 * Character set used for ID strings. This is intended to be the set of 32 most
 * visually and audibly unambiguous alphanumerics.
 */
const ID_CHARS = 'abcdefghjkmnpqrstuwxyz0123456789';

/**
 * Random number utilities. All values are generated using a cryptographically
 * secure random number generator.
 */
export default class Random extends UtilityClass {
  /**
   * Gets a random byte value (range `0` to `255` inclusive).
   *
   * @returns {Int} The byte.
   */
  static byte() {
    return crypto.randomBytes(1)[0];
  }

  /**
   * Returns a buffer of random bytes, of a given length.
   *
   * @param {Int} length Desired length.
   * @returns {Buffer} Buffer of `length` random bytes.
   */
  static byteBuffer(length) {
    return crypto.randomBytes(TInt.nonNegative(length));
  }

  /**
   * Returns a string of random hex digits (lower case), of a given length of
   * _bytes_. That is, the string length will be twice the given `length`.
   *
   * @param {Int} length Desired length of bytes.
   * @returns {string} String of `length * 2` random hexadecimal characters.
   */
  static hexByteString(length) {
    const bytes = Random.byteBuffer(length);
    return bytes.toString('hex');
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
