// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// **Note:** Webpack's browser polyfill includes a Node-compatible `crypto`
// module, which is why this is possible to import regardless of environment.
import crypto from 'crypto';

import { TInt, TString } from '@bayou/typecheck';
import { UtilityClass } from '@bayou/util-core';

/**
 * Character set used for ID strings. This is intended to be the set of 32 most
 * visually and audibly unambiguous lowercase alphanumerics.
 */
const ID_CHARS = 'abcdefghjkmnpqrstuwxyz0123456789';

/**
 * Random number utilities. All values are generated using a cryptographically
 * secure random number generator.
 */
export class Random extends UtilityClass {
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
   * Constructs an ID-ish string with the indicated tag prefix along with a dash
   * (`-`), and the given number of characters after the prefix.
   *
   * @param {string} prefix The prefix.
   * @param {Int} length The number of characters in the non-prefix portion of
   *   the ID.
   * @returns {string} The constructed random ID string.
   */
  static idString(prefix, length) {
    TString.nonEmpty(prefix);
    TInt.min(length, 1);

    const result = [`${prefix}-`];

    for (let i = 0; i < length; i++) {
      result.push(ID_CHARS[Random.byte() % ID_CHARS.length]);
    }

    return result.join('');
  }

  /**
   * Constructs a short label string with the indicated tag prefix. These are
   * _typically_ but not _guaranteed_ or _necessarily expected_ to be unique.
   * Instead, these are are intended to aid in disambiguating logs (and not for
   * anything deeper).
   *
   * @param {string} prefix The prefix.
   * @returns {string} The constructed random ID string.
   */
  static shortLabel(prefix) {
    return Random.idString(prefix, 8);
  }
}
