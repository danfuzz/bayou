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

    // Register the array codec, which both enables its usage and prevents its
    // tag from getting improperly re-registered by client code.
    this.registerCodec(SpecialCodecs.ARRAY);
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

    if (!clazz) {
      // For now, we only allow registration of class/instance codecs.
      // **TODO:** Allow other types.
      throw new Error(`Cannot register non-object type \`${codec.type}\`.`);
    } else if (this._tagToCodec.get(tag)) {
      throw new Error(`Cannot re-register tag \`${tag}\`.`);
    }

    this._tagToCodec.set(codec.tag, codec);

    let codecs = this._classToCodecs.get(clazz);
    if (!codecs) {
      codecs = [];
      this._classToCodecs.set(clazz, codecs);
    }

    codecs.push(codec);
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
    const valueType = typeof value;

    if (valueType !== 'object') {
      // For now, we only allow lookup of class/instance codecs. **TODO:** Allow
      // other types.
      throw new Error(`No codec registered for type \`${valueType}\`.`);
    }

    const clazz = value.constructor;
    const codecs = this._classToCodecs.get(clazz);

    if (!codecs) {
      throw new Error(`No codec registered for class \`${clazz.name}\`.`);
    }

    const applicable = codecs.filter(c => c.canEncode(value));
    switch (applicable.length) {
      case 0: {
        throw new Error(`No applicable codec for value of class \`${clazz.name}\`.`);
      }
      case 1: {
        return applicable[0];
      }
      default: {
        throw new Error(`Multiple applicable codecs for value of class \`${clazz.name}\`.`);
      }
    }
  }

  /**
   * Finds a previously-registered item codec by tag (name). This throws an
   * error if there is no codec registered with the given tag.
   *
   * @param {string} tag The item codec tag (name).
   * @returns {ItemCodec} The codec that was registered under the given name.
   */
  codecForTag(tag) {
    const result = this._tagToCodec.get(tag);

    if (!result) {
      throw new Error(`No codec registered with tag \`${tag}\`.`);
    }

    return result;
  }
}
