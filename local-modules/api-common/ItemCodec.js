// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TArray, TClass, TFunction, TString } from 'typecheck';
import { CommonBase } from 'util-common';

/**
 * Handler for API-codable items of a particular class, type, or (in general)
 * kind. This bundles the functionality of identifying codable values, naming
 * them, deriving construction parameters from instances of them, and
 * constructing instances of them from (presumably) previously-derived
 * parameters.
 */
export default class ItemCodec extends CommonBase {
  /**
   * Constructs an instance from a class that has the standard API-coding
   * methods.
   *
   * @param {function} clazz Class (constructor function) to base the instance
   *   on.
   * @returns {ItemCodec} An appropriately-constructed instance.
   */
  static fromClass(clazz) {
    TClass.check(clazz);
    TFunction.check(clazz.prototype.toApi);

    if (clazz.fromApi) {
      TFunction.check(clazz.fromApi);
    }

    const tag = clazz.API_NAME || clazz.name;
    const encode = (value) => { return value.toApi(); };
    const decode = clazz.fromApi
      ? (payload) => { return clazz.fromApi(...payload); }
      : (payload) => { return new clazz(...payload); };

    return new ItemCodec(tag, clazz, null, encode, decode);
  }

  /**
   * Constructs an instance.
   *
   * @param {string} tag Tag (name) for the item's type. This must be unique
   *   amongst all `ItemCodec`s using a given registry.
   * @param {function|string} clazzOrType Either the class (constructor
   *   function) which values must be exact instances of (not subclasses), or
   *   the (string) name of the type (as in `typeof value`) which values must
   *   be, in order to match this instance.
   * @param {function|null} predicate Additional predicate that values must
   *   satisfy in order to match this instance, or `null` if there are no
   *   additional qualifications.
   * @param {function} encode Encoder function, which accepts a single argument,
   *   `value`, of a value to encode as this item type. It must return an array
   *   of values which represent the construction parameters for the value.
   * @param {function} decode Decoder function, which accepts the same kinds of
   *   value that the `encode` function returns (that is, an array of
   *   construction parameters) . It must return a value that is equivalent to
   *   one that got encoded to produce the payload it received.
   */
  constructor(tag, clazzOrType, predicate, encode, decode) {
    super();

    /** {string} Tag (name) for the item's type. */
    this._tag = TString.nonempty(tag);

    /**
     * {function|null} The class (constructor function) which identifies
     * qualified values, or `null` if qualified values aren't objects.
     */
    this._clazz = ((typeof clazzOrType) === 'function')
      ? TClass.check(clazzOrType)
      : null;

    /** {string} Name of the type which identifies qualified values. */
    this._type = (this._clazz !== null) ? 'object' : TString.check(clazzOrType);

    /**
     * {function|null} Additional predicate that must be `true` of values for
     * them to qualify, if any.
     */
    this._predicate = TFunction.orNull(predicate);

    /** {function} Value encoder function. */
    this._encode = TFunction.check(encode);

    /** {function} Value decoder function. */
    this._decode = TFunction.check(decode);

    Object.freeze(this);
  }

  /**
   * {function|null} The class (constructor function) which identifies
   * qualified values, or `null` if qualified values aren't objects.
   */
  get clazz() {
    return this._clazz;
  }

  /**
   * {function|null} Additional predicate that must be `true` of values for them
   * to qualify, if any.
   */
  get predicate() {
    return this._predicate;
  }

  /** {string} Tag (name) for the item's type. */
  get tag() {
    return this._tag;
  }

  /** {string} Name of the type which identifies qualified values. */
  get type() {
    return this._type;
  }

  /**
   * Determines whether or not this instance is applicable to the given value,
   * that is, whether the value qualifies as being of this item's type/kind and
   * so can be encoded by this instance.
   *
   * @param {*} value Value to check.
   * @returns {boolean} `true` if this instance can be used to encode `value`,
   *   or `false` if not.
   */
  canEncode(value) {
    if ((typeof value) !== this.type) {
      return false;
    }

    if (this.clazz !== null) {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== this.clazz.prototype) {
        return false;
      }
    }

    return (this.predicate === null) || this.predicate(value);
  }

  /**
   * Decodes the given arguments into a value which is equivalent to one that
   * was previously encoded into those arguments using this instance.
   *
   * @param {array<*>} payload Arguments which resulted from an earlier call to
   *   `encode()` on this instance, or the equivalent thereto.
   * @returns {*} A value for which `canEncode()` on this instance would return
   *   `true`.
   */
  decode(payload) {
    const result = this._decode(payload);

    if (!this.canEncode(result)) {
      throw new Error('Invalid result from decoder.');
    }

    return result;
  }

  /**
   * Encodes the given value into arguments suitable for later passing to
   * `decode()` on this instance.
   *
   * @param {*} value Value to encode. It is only valid to pass a value for
   *   which `canEncode()` would have returned `true`.
   * @returns {array<*>} Array of arguments suitable for passing to `decode()`
   *   on this instance.
   */
  encode(value) {
    if (!this.canEncode(value)) {
      throw new Error('Attempt to encode invalid value.');
    }

    const result = this._encode(value);

    try {
      return TArray.check(result);
    } catch (e) {
      // Throw a higher-fidelity error.
      throw new Error('Invalid encoding result (not an array).');
    }
  }
}
