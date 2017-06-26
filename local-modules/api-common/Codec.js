// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Singleton } from 'util-common';

import Decoder from './Decoder';
import Encoder from './Encoder';
import Registry from './Registry';

/**
 * Encoder and decoder of values for transport over the API (or for storage on
 * disk or in databases).
 *
 * **TODO:** If and when `Registry` stops being a singleton, this class should
 * correspondingly stop being one too, since it will no longer be the case that
 * there is a unique registry to query.
 */
export default class Codec extends Singleton {
  /**
   * Converts a value that was previously converted with `encode()` (or the
   * equivalent) back into fully useful objects. Specifically:
   *
   * * Non-object / non-function values are passed through as-is.
   * * `null` is passed through as-is.
   * * Direct instances of `Object` (`x` such that `Object.getPrototypeOf(x) ===
   *   Object.prototype`) are allowed, with their values processed recursively
   *   using (the equivalent of) this method.
   * * Arrays whose first element is not a string (including empty arrays) are
   *   rejected.
   * * Other arrays are processed recursively using (the equivalent of) this
   *   method, without the first element. If the first element is the value
   *   `Registry.arrayTag` then the processed form is used as-is. Otherwise,
   *   the first element is used to look up a class that has been registered
   *   under that name. Its `fromApi()` method is called, passing the converted
   *   array as arguments. The result of that call becomes the result of
   *   conversion.
   * * All other objects (including functions) are rejected.
   *
   * In addition, if the result is an object (including an array), it is
   * guaranteed to be recursively frozen.
   *
   * @param {*} value Value to convert.
   * @returns {*} The converted value.
   */
  decode(value) {
    return new Decoder(Registry.theOne).decode(value);
  }

  /**
   * Converts JSON-encoded text to a usable value. See `decode()` for
   * details.
   *
   * @param {string} json Text to convert.
   * @returns {*} The converted value.
   */
  decodeJson(json) {
    return this.decode(JSON.parse(json));
  }

  /**
   * Converts an arbitrary value to a form suitable for JSON-encoding and
   * subsequent transfer over the API. In some cases, it rejects values.
   * Specifically:
   *
   * * Functions are rejected.
   * * Symbols are rejected.
   * * `undefined` is rejected.
   * * Other non-object values are passed through as-is.
   * * `null` is passed through as-is.
   * * Direct instances of `Object` (`x` such that `Object.getPrototypeOf(x) ===
   *   Object.prototype`) are allowed, with their values processed recursively
   *   using (the equivalent of) this method.
   * * Arrays with holes (unset value of `x[n]` for `n < x.length`) are
   *   rejected.
   * * Arrays with non-numeric properties are rejected.
   * * Other arrays are allowed, with their values processed recursively using
   *   (the equivalent of) this method. The encoded form is also an array but
   *   with an additional first element of the value `Registry.arrayTag`.
   * * Objects which bind a method `toApi()` and whose constructor binds a
   *   property `API_NAME` are allowed. Such objects will have `toApi()` called
   *   on them, which is expected to result in an array which is suitable for
   *   processing using (the equivalent of) this method. The encoded form is an
   *   array with the first element the value of `API_NAME` and the rest of the
   *   elements whatever was returned by `toApi()`.
   * * All other objects are rejected.
   *
   * In addition, if the result is an object (including an array), it is
   * guaranteed to be recursively frozen.
   *
   * @param {*} value Value to convert.
   * @returns {*} The converted value.
   */
  encode(value) {
    return new Encoder(Registry.theOne).encode(value);
  }

  /**
   * Converts an arbitrary value to JSON-encoded text. See `encode()` for
   * details.
   *
   * @param {*} value Value to convert.
   * @param {boolean} [pretty = false] Whether to "pretty-print" (indent and
   *   space for human consumption) the result.
   * @returns {string} The converted value.
   */
  encodeJson(value, pretty = false) {
    return JSON.stringify(this.encode(value), null, pretty ? 2 : 0);
  }
}
