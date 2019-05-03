// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { FrozenBuffer, Functor, ObjectUtil, UtilityClass } from '@bayou/util-common';

import { ItemCodec } from './ItemCodec';

/**
 * Utility class which holds special `ItemCodec`s (that is, ones that aren't
 * straightforward coders for class instances).
 */
export class SpecialCodecs extends UtilityClass {
  /** {ItemCodec} Codec used for coding arrays. */
  static get ARRAY() {
    return new ItemCodec(ItemCodec.tagFromType('array'), 'array', this._arrayPredicate,
      this._arrayEncode, this._arrayDecode);
  }

  /**
   * Decodes an array.
   *
   * @param {array<*>} payload Construction payload as previously produced by
   *   `_arrayEncode()`.
   * @param {function} subDecode Function to call to decode component values
   *   inside `payload`, as needed.
   * @returns {array<*>} Decoded array.
   */
  static _arrayDecode(payload, subDecode) {
    return Object.freeze(payload.map(subDecode));
  }

  /**
   * Encodes an array.
   *
   * @param {array<*>} value Array to encode.
   * @param {function} subEncode Function to call to encode component values
   *   inside `value`, as needed.
   * @returns {array<*>} Encoded form.
   */
  static _arrayEncode(value, subEncode) {
    // Because of how the calling code operates, we know that by the time we get
    // here, `value` has passed `arrayPredicate()`. This means that all we have
    // to do is encode all the elements.
    return value.map(subEncode);
  }

  /**
   * Checks a value for encodability as an array.
   *
   * @param {array<*>} value Array to (potentially) encode.
   * @returns {boolean} `true` iff `value` can be encoded.
   */
  static _arrayPredicate(value) {
    // Check for holes in the indexed properties as well as synthetic
    // properties. An array with either of these is not encodable.
    for (let i = 0; i < value.length; i++) {
      const desc = Object.getOwnPropertyDescriptor(value, i);
      if (   (desc === undefined)
          || (desc.get !== undefined)
          || (desc.set !== undefined)) {
        return false;
      }
    }

    // Since we know there are no holes (per above), the only way we could have
    // a different number of keys than the array `length` is if there are
    // additional named (non-indexed) properties. If this is the case, then the
    // array is not encodable.
    if (value.length !== Object.keys(value).length) {
      return false;
    }

    return true;
  }

  /** {ItemCodec} Codec used for coding `FrozenBuffer`s. */
  static get FROZEN_BUFFER() {
    return new ItemCodec('buf', FrozenBuffer, null,
      this._frozenBufferEncode, this._frozenBufferDecode);
  }

  /**
   * Decodes a `FrozenBuffer`.
   *
   * @param {array<*>} payload Construction payload as previously produced by
   *   `_frozenBufferEncode()`.
   * @param {function} subDecode Function to call to decode component values
   *   inside `payload`, as needed.
   * @returns {FrozenBuffer} Decoded instance.
   */
  static _frozenBufferDecode(payload, subDecode) {
    // Even though the expected case is that strings self-code, we call
    // `subDecode()` anyway to protect against the unexpected (at insubstantial
    // cost).
    const [base64Enc] = payload;
    const base64      = subDecode(base64Enc);

    return new FrozenBuffer(base64, 'base64');
  }

  /**
   * Encodes a `FrozenBuffer`.
   *
   * @param {FrozenBuffer} value Instance to encode.
   * @param {function} subEncode Function to call to encode component values
   *   inside `value`, as needed.
   * @returns {array<*>} Encoded form.
   */
  static _frozenBufferEncode(value, subEncode) {
    // Even though the expected case is that strings self-code, we call
    // `subEncode()` anyway to protect against the unexpected (at insubstantial
    // cost).
    return [subEncode(value.base64)];
  }

  /** {ItemCodec} Codec used for coding functors. */
  static get FUNCTOR() {
    return new ItemCodec('f', Functor, null,
      this._functorEncode, this._functorDecode);
  }

  /**
   * Decodes a functor.
   *
   * @param {array<*>} payload Construction payload as previously produced by
   *   `_functorEncode()`.
   * @param {function} subDecode Function to call to decode component values
   *   inside `payload`, as needed.
   * @returns {Functor} Decoded functor.
   */
  static _functorDecode(payload, subDecode) {
    const decodedArgs = payload.map(subDecode);
    return new Functor(...decodedArgs);
  }

  /**
   * Encodes a functor.
   *
   * @param {Functor} value Functor to encode.
   * @param {function} subEncode Function to call to encode component values
   *   inside `value`, as needed.
   * @returns {array<*>} Encoded form.
   */
  static _functorEncode(value, subEncode) {
    return value.deconstruct().map(subEncode);
  }

  /** {ItemCodec} Codec used for coding plain objects. */
  static get PLAIN_OBJECT() {
    return new ItemCodec('object', 'object',
      ObjectUtil.isPlain, this._objectEncode, this._objectDecode);
  }

  /**
   * Decodes a plain object.
   *
   * @param {object} payload Construction payload as previously produced by
   *   `_objectEncode()`.
   * @param {function} subDecode Function to call to decode component values
   *   inside `payload`, as needed.
   * @returns {object} Decoded object.
   */
  static _objectDecode(payload, subDecode) {
    // Iterate over all the properties in `payload`, decoding the bound values.
    const result = {};
    for (const [k, v] of payload) {
      result[k] = subDecode(v);
    }

    return Object.freeze(result);
  }

  /**
   * Encodes a plain object.
   *
   * @param {object} value Object to encode.
   * @param {function} subEncode Function to call to encode component values
   *   inside `value`, as needed.
   * @returns {object} Encoded form.
   */
  static _objectEncode(value, subEncode) {
    // Sort the keys to avoid nondeterminism.
    const keys = Object.keys(value).sort();

    return keys.map((key) => {
      return Object.freeze([key, subEncode(value[key])]);
    });
  }

  /**
   * Makes a self-representative codec which matches the given value type.
   * The result encodes and decodes all values of the type to themselves.
   *
   * @param {string} type Name of the type.
   * @returns {ItemCodec} Codec for `type` which passes values through unaltered
   *   in both directions.
   */
  static selfRepresentative(type) {
    return new ItemCodec(ItemCodec.tagFromType(type), type, null,
      this._passThrough, this._passThrough);
  }

  /**
   * Implementation of both `encode()` and `decode()` for any
   * self-representative codec, which (per `selfRepresentative()`) passes
   * through values unaltered.
   *
   * @param {*} valueOrPayload The value or payload.
   * @param {function} subCoder_unused The sub-encoder or sub-decoder.
   * @returns {*} `valueOrPayload`, always.
   */
  static _passThrough(valueOrPayload, subCoder_unused) {
    return valueOrPayload;
  }
}
