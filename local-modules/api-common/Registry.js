// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

import ItemCodec from './ItemCodec';

/** {ItemCodec} Item codec for arrays. */
const ARRAY_CODEC = new ItemCodec('array', Array, null,
  (value => value),
  ((...args) => args)
);

/**
 * Methods for registering and looking up item codecs by name. The names are
 * how classes/types are identified when encoding and decoding instances on
 * the wire (for API transmission and receipt, and for storage to disk or in
 * a database).
 */
export default class Regsitry extends CommonBase {
  /**
   * Constructs the instance.
   */
  constructor() {
    super();

    /**
     * {Map<string,ItemCodec>} Map of registered names to their respective
     * item codecs.
     *
     * **Note:** The constructor argument here initializes the registry with the
     * handler for arrays, which both enables its usage and prevents it from
     * getting improperly registered by client code.
     */
    this._registry = new Map([[ARRAY_CODEC.name, ARRAY_CODEC]]);
  }

  /** {string} The item tag used for regular arrays. */
  get arrayTag() {
    return ARRAY_CODEC.tag;
  }

  /**
   * Registers a class to be accepted for API use. To be valid, a class must
   * define an instance method `toApi()`. In addition, it can optionally
   * define a static property `API_NAME` as a replacement for its class name
   * for use as the tag when encoding; and optionally define a static method
   * `fromApi()` to override the default of using the class's constructor when
   * decoding.
   *
   * @param {object} clazz The class to register.
   */
  registerClass(clazz) {
    const itemCodec = ItemCodec.fromClass(clazz);
    const tag       = itemCodec.tag;

    if (this._registry.get(tag)) {
      throw new Error(`Cannot re-register tag \`${tag}\`.`);
    }

    this._registry.set(tag, itemCodec);
  }

  /**
   * Finds a previously-registered class by tag (name). This throws an error if
   * there is no registered class with the given tag.
   *
   * @param {string} tag The item codec tag (name).
   * @returns {class} The class that was registered under the given name.
   */
  classForName(tag) {
    const result = this.codecForTag(tag);

    if (!(result.clazz && !result.predicate)) {
      throw new Error(`No class registered with tag \`${tag}\`.`);
    }

    return result.clazz;
  }

  /**
   * Finds a previously-registered item codec by tag (name). This throws an
   * error if there is no codec registered with the given tag.
   *
   * @param {string} tag The item codec tag (name).
   * @returns {ItemCodec} The codec that was registered under the given name.
   */
  codecForTag(tag) {
    const result = this._registry.get(tag);

    if (!result) {
      throw new Error(`No codec registered with tag \`${tag}\`.`);
    }

    return result;
  }
}
