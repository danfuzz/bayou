// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase, FrozenBuffer } from '@bayou/util-common';

import { ConstructorCall } from './ConstructorCall';
import { Registry } from './Registry';

/**
 * Encoder and decoder of values for transport over an API or for storage on
 * disk or in databases, with binding to a name-to-class registry.
 */
export class Codec extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Registry} [registry = null] Registry to use. If `null`, the
   *   instance will use a newly-constructed {@link Registry} instance.
   */
  constructor(registry = null) {
    super();

    /** {Registry} The registry to use. */
    this._registry = (registry === null)
      ? new Registry()
      : Registry.check(registry);

    /** {function} Handy pre-bound version of `decodeData()`. */
    this._decodeData = this.decodeData.bind(this);

    /** {function} Handy pre-bound version of `encodeData()`. */
    this._encodeData = this.encodeData.bind(this);
  }

  /** {Registry} The codec registry used by this instance. */
  get registry() {
    return this._registry;
  }

  /**
   * Converts a "pure data" value that was previously converted with
   * `encodeData()` (or the equivalent) back into fully useful objects.
   * Specifically:
   *
   * * Non-object / non-function values are passed through as-is.
   *
   * * `null` is passed through as-is.
   *
   * * Direct instances of `Array` are allowed, with their values processed
   *   recursively using (the equivalent of) this method.
   *
   * * Instances of {@link ConstructorCall} are allowed.
   *
   * * All other values (including functions and objects in general) are
   *   rejected.
   *
   * Plain object and array results are guaranteed to be frozen.
   *
   * @param {*} payload Payload to decode.
   * @returns {*} The decoded value.
   */
  decodeData(payload) {
    const itemCodec = this._registry.codecForPayload(payload);
    return itemCodec.decode(payload, this._decodeData);
  }

  /**
   * Converts JSON-encoded text to a usable value. See {@link #decodeData} for
   * details. Beyond what is specified there:
   *
   * * Plain objects which map a single string key to an array are decoded into
   *   instances of {@link ConstructorCall}.
   *
   * * No other object forms are allowed.
   *
   * @param {string} json Text to convert.
   * @returns {*} The converted value.
   */
  decodeJson(json) {
    return this.decodeData(JSON.parse(json, ConstructorCall.revive));
  }

  /**
   * Converts JSON-encoded text in a `FrozenBuffer` to a usable value.
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
   * * Symbols are rejected.
   *
   * * `undefined` is rejected.
   *
   * * Other non-object values are passed through as-is.
   *
   * * `null` is passed through as-is.
   *
   * * Plain arrays (direct instances of `Array`, with no holes and only
   *   non-negative integer keys) are allowed. They are converted by processing
   *   their elements recursively using (the equivalent of) this method.
   *
   * * Plain objects (direct instances of `Object` (`x` such that
   *   `Object.getPrototypeOf(x) === Object.prototype`) are allowed. They are
   *   converted into a single-key form, similar to class instances (per
   *   immediately below).
   *
   * * Objects that are instances of classes (that is, have constructor
   *   functions) are allowed, as long as they at least bind a method
   *   `deconstruct()`. In addition, if they have a static `CODEC_TAG` property
   *   then that is used as the tag (class name) in encoded form. The encoded
   *   form is an instance of {@link ConstructorCall}.
   *
   * * All other values are rejected.
   *
   * In addition, if the result is an object (including an array), it is
   * guaranteed to be recursively frozen.
   *
   * @param {*} value Value to encode.
   * @returns {*} The encoded value payload.
   */
  encodeData(value) {
    const itemCodec = this._registry.codecForValue(value);
    return itemCodec.encode(value, this._encodeData);
  }

  /**
   * Converts an arbitrary value to JSON-encoded text. See {@link #encodeData}
   * for details. Beyond what is specified there:
   *
   * * Instances of {@link ConstructorCall} are encoded as a single-binding
   *   plain object, mapping the class tag string to the constructor arguments.
   *   For example, the encoding of `ConstructorCall.from('x', 1, 2))` is
   *   `{ "x": [1, 2] }`.
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
   * converted to a `FrozenBuffer`.
   *
   * @param {*} value Value to encode.
   * @returns {FrozenBuffer} Encoded and bufferized value.
   */
  encodeJsonBuffer(value) {
    return FrozenBuffer.coerce(this.encodeJson(value));
  }
}
