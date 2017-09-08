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
 *
 * The `decode` and `encode` arguments to the constructor are the "workhorses"
 * of an instance of this class. Each of these takes two parameters, the second
 * of which is a function to recursively code any sub-components of the value in
 * question:
 *
 * * `decode(payload, subDecode)` &mdash; `payload` is the payload to decode
 *   into a value, and `subDecode(subPayload)` is a function to call on any
 *   sub-components of the payload; it returns the decoded form of `subPayload`.
 *   The overall return value from `decode()` is a value that is (or is
 *   equivalent to) one that was encoded via `encode()` on this instance to
 *   produce the received `payload`.
 *
 * * `encode(value, subEncode)` &mdash; `value` is the value to encode, and
 *   `subEncode(subValue)` is a function to call on any sub-components of the
 *   value; it returns the encoded form of `subValue`. The overall return value
 *   from `encode()` is a payload which is suitable for passing into `decode()`
 *   on the same (or equivalent) item codec.
 *
 * In most cases, the encoded payload returned by `encode()` and taken by
 * `decode()` is an array. This is the classic "reconstruction arguments" style
 * of object coding, and is what is done by instances produced by the
 * `fromClass()` static method. However, this system also supports two other
 * possibilities:
 *
 * * The encoded form is allowed to be a plain JavaScript object, that is, a
 *   simple mapping of string keys to arbitrary values.
 *
 * * The encoded form is allowed to be a non-object value, such as a number or
 *   string.
 *
 * In these cases, the codec instance needs to be tagged with the type of the
 * value and not a class-name-like string. For the purposes of this class, the
 * value `null` is considered a distinct type from non-null object values and
 * has the type name `'null'`.
 */
export default class ItemCodec extends CommonBase {
  /**
   * Gets the tag string (either explicit or implicit) of the given payload.
   * This returns `null` if the payload can't possibly be valid; this is the
   * case for empty arrays and arrays whose first element is not a string.
   *
   * @param {*} payload The payload in question.
   * @returns {string|null} The tag of the payload, or `null` if it is not a
   *   valid payload.
   */
  static tagFromPayload(payload) {
    if (Array.isArray(payload)) {
      const tag = payload[0];
      return ((typeof tag) === 'string') ? tag : null;
    } else {
      return ItemCodec.tagFromType(ItemCodec.typeOf(payload));
    }
  }

  /**
   * Gets the tag string to use when the encoded form is a value of a particular
   * type (and not the usual "construction arguments" form).
   *
   * @param {string} type The name of the type.
   * @returns {string} The corresponding tag to use.
   */
  static tagFromType(type) {
    return `type:${type}`;
  }

  /**
   * Performs the reverse of `tagFromType()`, see which. This returns `null` if
   * the given tag isn't of the right form to be a type name.
   *
   * @param {string} tag The tag.
   * @returns {string|null} The corresponding type name, or `null` if `tag`
   *   doesn't represent a type name.
   */
  static typeFromTag(tag) {
    return /^type:/.test(tag) ? tag.slice(5) : null;
  }

  /**
   * Like `typeof value`, except that `null` is treated as its own type, instead
   * of being called an `object`.
   *
   * @param {*} value Value in question.
   * @returns {string} Name of value's type, with the type of `null` being
   *   `'null'`.
   */
  static typeOf(value) {
    return (value === null) ? 'null' : (typeof value);
  }

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

    const tag = clazz.API_TAG || clazz.name;

    let fromApi;
    if (clazz.fromApi) {
      fromApi = TFunction.check(clazz.fromApi);
    } else {
      fromApi = (...args) => new clazz(...args);
    }

    const encode = (value, subEncode) => {
      const payload = TArray.check(value.toApi());
      return payload.map(subEncode);
    };

    const decode = (payload, subDecode) => {
      payload = payload.map(subDecode);
      return fromApi(...payload);
    };

    return new ItemCodec(tag, clazz, null, encode, decode);
  }

  /**
   * Constructs an instance.
   *
   * @param {string} tag Tag (name) for the item's type in encoded form, if in
   *   "construction arguments" array form. Or, if not encoded as such an array,
   *   the name of the type of its encoded value form as produced by a call to
   *   `tagForType()`; e.g., if the encoded form is a number, this would be
   *   `ItemCodec.tagForType('number')`.
   * @param {function|string} clazzOrType Either the class (constructor
   *   function) which values must be exact instances of (not subclasses), or
   *   the (string) name of the type (as in `ItemCodec.typeof(value)`) which
   *   values must be, in order to match this instance.
   * @param {function|null} predicate Additional predicate that values must
   *   satisfy in order to match this instance, or `null` if there are no
   *   additional qualifications.
   * @param {function} encode Encoder function, as described in this class's
   *   header.
   * @param {function} decode Decoder function, as described in this class's
   *   header.
   */
  constructor(tag, clazzOrType, predicate, encode, decode) {
    super();

    /** {string} Tag (name) for the item's type. */
    this._tag = TString.nonempty(tag);

    /**
     * {string|null} Type name for the encoded form, or `null` if this instance
     * encodes into "construction arguments" form.
     */
    this._encodedType = ItemCodec.typeFromTag(tag);

    /**
     * {function|null} The class (constructor function) which identifies
     * qualified values, or `null` if qualified values aren't objects of a
     * specific class (and not, e.g. a class-or-subclass).
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
   * {string|null} Name of the type of encoded values, if they are _not_
   * encoded in "construction arguments" form. This is `null` for a
   * "construction arguments" form.
   */
  get encodedType() {
    return this._encodedType;
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

  /**
   * {string} Name of the type which identifies qualified values for encoding.
   */
  get type() {
    return this._type;
  }

  /**
   * Determines whether or not this instance is applicable to the given payload,
   * by checking the payload's tag, which is either explicit (first element of
   * an array payload) or implicit (derived from the value type of the payload,
   * for all other payloads).
   *
   * @param {*} payload Payload to check.
   * @returns {boolean} `true` if this instance can be used to decode `payload`,
   *   or `false` if not.
   */
  canDecode(payload) {
    return ItemCodec.tagFromPayload(payload) === this._tag;
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
    if (ItemCodec.typeOf(value) !== this.type) {
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
   * @param {function} subDecode Function to call to decode component values
   *   inside `payload`, as needed.
   * @returns {*} A value for which `canEncode()` on this instance would return
   *   `true`.
   */
  decode(payload, subDecode) {
    if (!this.canDecode(payload)) {
      throw new Error('Attempt to decode invalid payload.');
    }

    if (Array.isArray(payload)) {
      // Strip off the tag before passing to `decode()`.
      payload = payload.slice(1);
    }

    const result = this._decode(payload, subDecode);

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
   * @param {function} subEncode Function to call to encode component values
   *   inside `value`, as needed.
   * @returns {array<*>} Array of arguments suitable for passing to `decode()`
   *   on this instance.
   */
  encode(value, subEncode) {
    if (!this.canEncode(value)) {
      throw new Error('Attempt to encode invalid value.');
    }

    const encodedType = this._encodedType;
    const result      = this._encode(value, subEncode);

    // Validate the result, and in the case of normal "construction arguments"
    // arrays, add the tag as the first element of the payload.
    if (encodedType === null) {
      try {
        TArray.check(result);
      } catch (e) {
        // Throw a higher-fidelity error.
        throw new Error('Invalid encoding result (not an array).');
      }

      result.unshift(this._tag);
    } else if (ItemCodec.typeOf(result) !== encodedType) {
      throw new Error('Invalid encoding result: ' +
        `got type ${ItemCodec.typeOf(result)}; expected type ${encodedType}`);
    }

    return Object.freeze(result);
  }
}
