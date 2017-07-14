// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

import ItemCodec from './ItemCodec';
import SpecialCodecs from './SpecialCodecs';

/**
 * Methods for registering and looking up item codecs by name. The names are
 * how classes/types are identified when encoding and decoding instances on
 * the wire (for API transmission and receipt, and for storage to disk or in
 * a database).
 */
export default class Registry extends CommonBase {
  /**
   * Constructs the instance.
   */
  constructor() {
    super();

    /**
     * {Map<string,ItemCodec>} Map of registered item tags to their respective
     * item codecs.
     */
    this._tagToCodec = new Map();

    /**
     * {Map<class,array<ItemCodec>>} Map of classes that have `ItemCodec`s
     * registered to the set of such codecs. The reason there can be more than
     * one is that some classes can be encoded multiple ways, with the multiple
     * `ItemCodec`'s `predicate`s determining which one applies.
     */
    this._classToCodecs = new Map();

    /**
     * {Map<string,array<ItemCodec>} Map of non-class types that have
     * `ItemCodec`s registered to the set of such codecs. There can be more
     * than one codec per type for the same reason as `_classToCodecs` can (see
     * which).
     */
    this._typeToCodecs = new Map();

    // Register all the special codecs.
    this.registerCodec(SpecialCodecs.ARRAY);
    this.registerCodec(SpecialCodecs.SIMPLE_OBJECT);
    this.registerCodec(SpecialCodecs.selfRepresentative('boolean'));
    this.registerCodec(SpecialCodecs.selfRepresentative('null'));
    this.registerCodec(SpecialCodecs.selfRepresentative('number'));
    this.registerCodec(SpecialCodecs.selfRepresentative('string'));
  }

  /**
   * Registers a class to be accepted for API use. To be valid, a class must
   * define an instance method `toApi()`. In addition, it can optionally
   * define a static property `API_TAG` as a replacement for its class name
   * for use as the tag when encoding; and optionally define a static method
   * `fromApi()` to override the default of using the class's constructor when
   * decoding.
   *
   * @param {object} clazz The class to register.
   */
  registerClass(clazz) {
    this.registerCodec(ItemCodec.fromClass(clazz));
  }

  /**
   * Registers an item codec.
   *
   * @param {ItemCodec} codec The codec to register.
   */
  registerCodec(codec) {
    ItemCodec.check(codec);

    const tag   = codec.tag;
    const clazz = codec.clazz;

    if (this._tagToCodec.get(tag)) {
      throw new Error(`Cannot re-register tag \`${tag}\`.`);
    }

    this._tagToCodec.set(codec.tag, codec);

    // Add the codec to the appropriate reverse map.

    const [reverseMap, key] = (clazz === null)
      ? [this._typeToCodecs,  codec.encodedType]
      : [this._classToCodecs, clazz];
    let codecs = reverseMap.get(key);

    if (!codecs) {
      codecs = [];
      reverseMap.set(key, codecs);
    }

    codecs.push(codec);
  }

  /**
   * Finds a previously-registered item codec which is suitable for decoding the
   * given payload. This throws an error if there is no codec registered for
   * the payload's tag (either explicit or implicit tag) or if the payload is
   * invalid.
   *
   * @param {payload} payload The payload to (potentially) decode.
   * @returns {ItemCodec} The codec that was registered for the payload's tag.
   */
  codecForPayload(payload) {
    const tag = ItemCodec.tagFromPayload(payload);

    if (tag === null) {
      throw new Error('Invalid payload (no tag).');
    }

    const result = this._tagToCodec.get(tag);

    if (!result) {
      throw new Error(`No codec registered with tag \`${tag}\`.`);
    }

    return result;
  }

  /**
   * Finds a previously-registered item codec which is suitable for encoding the
   * given value. This throws an error if there is no suitable codec or if there
   * is more than one suitable codec.
   *
   * @param {*} value The value in question.
   * @returns {ItemCodec} A codec suitable for encoding `value`.
   */
  codecForValue(value) {
    const valueType = ItemCodec.typeOf(value);
    let clazz;
    let codecs;

    if (   (valueType === 'object')
        && (Object.getPrototypeOf(value) !== Object.prototype)) {
      // The value is an instance of a class.
      clazz = value.constructor;
      codecs = this._classToCodecs.get(clazz);
    } else {
      // The value is a non-class-instance, including possibly being a simple
      // object (e.g., `{florps: 10}`) or `null`.
      clazz = null;
      codecs = this._typeToCodecs.get(valueType);
    }

    if (!codecs) {
      const name = Registry._nameForError(clazz, valueType);
      throw new Error(`No codec registered for ${name}.`);
    }

    const applicable = codecs.filter(c => c.canEncode(value));
    switch (applicable.length) {
      case 0: {
        const name = Registry._nameForError(clazz, valueType);
        throw new Error(`No applicable codec for value of ${name}.`);
      }
      case 1: {
        return applicable[0];
      }
      default: {
        const name = Registry._nameForError(clazz, valueType);
        throw new Error(`Multiple applicable codecs for value of ${name}.`);
      }
    }
  }

  /**
   * Helper for `codecForValue()` which builds an appropriate "name" string for
   * use in error messages.
   *
   * @param {function|null} clazz The salient class, or `null` if there is none.
   * @param {string} valueType The salient value type name.
   * @returns {string} A human-oriented "name" string, for use in error
   *   messages.
   */
  static _nameForError(clazz, valueType) {
    return clazz ? `class \`${clazz.name}\`` : `type \`${valueType}\``;
  }
}
