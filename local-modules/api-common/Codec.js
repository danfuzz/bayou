// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { FrozenBuffer, Singleton } from 'util-common';

import Decoder from './Decoder';
import Encoder from './Encoder';
import Registry from './Registry';

/**
 * Encoder and decoder of values for transport over the API (or for storage on
 * disk or in databases), with binding to a name-to-class registry.
 *
 * **TODO:** This class should probably _not_ be a singleton, in that there are
 * legitimately multiple different API coding contexts which ultimately might
 * want to have different sets of classes (or different name bindings even if
 * the classes overlap).
 */
export default class Codec extends Singleton {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    /**
     * {Registry} The registry instance to use. **Note:** If and when this class
     * stops being a singleton, this will get set from a constructor argument.
     */
    this._reg = new Registry();
  }

  /**
   * Converts a "pure data" value that was previously converted with
   * `encodeData()` (or the equivalent) back into fully useful objects.
   * Specifically:
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
  decodeData(value) {
    return new Decoder(this._reg).decodeData(value);
  }

  /**
   * Converts JSON-encoded text to a usable value. See `decodeData()` for
   * details.
   *
   * @param {string} json Text to convert.
   * @returns {*} The converted value.
   */
  decodeJson(json) {
    return this.decodeData(JSON.parse(json));
  }

  /**
   * Converts JSON-encoded text in a `FrozenBuffer` to a usable value. See
   * `decodeData()` for details.
   *
   * @param {FrozenBuffer} encoded Value to decode.
   * @returns {*} Decoded value.
   */
  decodeJsonBuffer(encoded) {
    FrozenBuffer.check(encoded);
    return this.decodeJson(encoded.string);
  }

  /**
   * Converts an arbitrary value to a "pure data" form suitable for
   * JSON-encoding and/or transfer over an API boundary. In some cases, it
   * rejects values. Specifically:
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
   * * Objects that are instances of classes (that is, have constructor
   *   functions) are allowed, as long as they at least bind a method `toApi()`.
   *   In addition, if they have a static `API_NAME` property and/or a static
   *   `fromApi()` method, those are used. See `ItemCodec` for how these are all
   *   used to effect encoding and decoding. The encoded form is an array with
   *   the first element being the value tag (typically the class name) and the
   *   rest of the elements whatever was returned by `toApi()`.
   * * All other objects are rejected.
   *
   * In addition, if the result is an object (including an array), it is
   * guaranteed to be recursively frozen.
   *
   * @param {*} value Value to convert.
   * @returns {*} The converted value.
   */
  encodeData(value) {
    return new Encoder(this._reg).encodeData(value);
  }

  /**
   * Converts an arbitrary value to JSON-encoded text. See `encodeData()` for
   * details.
   *
   * @param {*} value Value to convert.
   * @param {boolean} [pretty = false] Whether to "pretty-print" (indent and
   *   space for human consumption) the result.
   * @returns {string} The converted value.
   */
  encodeJson(value, pretty = false) {
    return JSON.stringify(this.encodeData(value), null, pretty ? 2 : 0);
  }

  /**
   * Converts an arbitrary value to JSON-encoded text, which is furthermore
   * converted to a `FrozenBuffer`. See `encodeData()` for details.
   *
   * @param {*} value Value to encode.
   * @returns {FrozenBuffer} Encoded and bufferized value.
   */
  encodeJsonBuffer(value) {
    return FrozenBuffer.coerce(this.encodeJson(value));
  }

  /**
   * Registers a class to be accepted for API use. This is a pass-through to
   * the method of the same name on the instance's `Registry`.
   *
   * @param {object} clazz The class to register.
   */
  registerClass(clazz) {
    this._reg.registerClass(clazz);
  }
}
