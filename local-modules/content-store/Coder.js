// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Codec } from 'api-common';
import { FrozenBuffer } from 'util-server';
import { UtilityClass } from 'util-common';

/**
 * Utility class for converting between arbitrary values and their stored
 * form as `FrozenBuffer`s.
 */
export default class Coder extends UtilityClass {
  /**
   * Encodes an arbitrary value using API coding, and converts it to a
   * `FrozenBuffer`.
   *
   * @param {*} value Value to encode.
   * @returns {FrozenBuffer} Encoded and bufferized value.
   */
  static encode(value) {
    return FrozenBuffer.coerce(Codec.theOne.encodeJson(value));
  }

  /**
   * Decodes a buffer, interpreting it via the API coding.
   *
   * @param {FrozenBuffer} encoded Value to decode.
   * @returns {*} Decoded value.
   */
  static decode(encoded) {
    FrozenBuffer.check(encoded);
    return Codec.theOne.decodeJson(encoded.string);
  }
}
