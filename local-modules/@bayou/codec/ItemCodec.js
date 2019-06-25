// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Logger } from '@bayou/see-all';
import { TArray, TFunction, TString } from '@bayou/typecheck';
import { CommonBase, Errors, Functor } from '@bayou/util-common';

import { ConstructorCall } from './ConstructorCall';

/** {Logger} Logger for this module. */
const log = new Logger('codec');

/**
 * Handler for codable items of a particular class, type, or (in general) kind.
 * This bundles the functionality of identifying codable values, naming them,
 * deriving construction parameters from instances of them, and constructing
 * instances of them from (presumably) previously-derived parameters.
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
 * In most cases, the encoded payload returned by the provided `encode()`
 * function and taken by the provided `decode()` function is an array of
 * arbitrary values. This is the classic "reconstruction arguments" style of
 * object coding, and is what is done by instances produced by the `fromClass()`
 * static method. In such cases, the public {@link #encode} and {@link #decode}
 * methods exported by this class take or return an instance of
 * {@link ConstructorCall} representing both the item's tag string and the
 * encoded value's argument array.
 *
 * This system also supports the possibility of encoding into and decoding from
 * something other than "reconstruction arguments" form. (This is indicated by
 * the instance using a type-based tag instead of a regular tag string.) In
 * practice, this is used to encode simple values (e.g., numbers and literal
 * strings) and arrays.
 *
 * **Note:** For the purposes of this class, `null`, arrays, plain objects, and
 * class instances are all considered values with distinct types.
 */
export class ItemCodec extends CommonBase {
  /**
   * Gets the tag string (either explicit or implicit) of the given payload.
   * This returns `null` if the payload can't possibly be valid.
   *
   * @param {*} payload The payload in question.
   * @returns {string|null} The tag of the payload, or `null` if it is not a
   *   valid payload.
   */
  static tagFromPayload(payload) {
    const type = ItemCodec.typeOf(payload);

    switch (type) {
      case 'object': {
        // Plain objects aren't allowed as encoded payloads at this layer.
        // (In JSON form, constructor instances are plain objects, but by the
        // time we get here, those will be instances of `ConstructorCall`,
        // handled immediately below.)
        return null;
      }

      case 'instance': {
        return (payload instanceof ConstructorCall)
          ? payload.payload.name
          : null;
      }

      default: {
        return ItemCodec.tagFromType(type);
      }
    }
  }

  /**
   * Gets the tag string to use when the encoded form is a value of a particular
   * type (and not the usual "construction arguments" array form).
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
   * Like `typeof value`, except:
   *
   * * `null` is given the type `null`, instead of `object`.
   * * Arrays are given the type `array`, instead of `object`.
   * * Other non-plain objects (aside from functions) are given the type
   *   `instance`.
   *
   * @param {*} value Value in question.
   * @returns {string} Name of value's type.
   */
  static typeOf(value) {
    const rawType = typeof value;

    if (rawType !== 'object') {
      return rawType;
    } else if (value === null) {
      return 'null';
    } else if (Array.isArray(value)) {
      return 'array';
    } else if (Object.getPrototypeOf(value) === Object.prototype) {
      return 'object';
    } else {
      return 'instance';
    }
  }

  /**
   * Constructs an instance from a class that has the standard coding methods.
   *
   * @param {function} clazz Class (constructor function) to base the instance
   *   on.
   * @returns {ItemCodec} An appropriately-constructed instance.
   */
  static fromClass(clazz) {
    TFunction.checkClass(clazz);
    TFunction.checkCallable(clazz.prototype.deconstruct);

    const tag = clazz.CODEC_TAG || clazz.name;

    if ((typeof tag !== 'string') || (tag === '')) {
      // This situation has been observed to show up. It might be a
      // code-mangling issue, or it might be a string-security-configuration
      // (CSP) type issue. Jury's still out, but in any case, should we find
      // ourselves looking at a class with no name, there's nothing we can do to
      // rectify the situation.
      log.event.namelessClass(clazz, clazz.name, clazz.CODEC_TAG);
      throw Errors.badUse('Cannot create codec from nameless-and-tagless class');
    }

    const encode = (value, subEncode) => {
      const payload = TArray.check(value.deconstruct());
      return payload.map(subEncode);
    };

    const decode = (payload, subDecode) => {
      payload = payload.map(subDecode);
      return new clazz(...payload);
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
    this._tag = TString.nonEmpty(tag);

    /**
     * {string|null} Type name for the encoded form, or `null` if this instance
     * encodes into "construction arguments" array form.
     */
    this._encodedType = ItemCodec.typeFromTag(tag);

    /**
     * {function|null} The class (constructor function) which identifies
     * qualified values, or `null` if qualified values aren't objects of a
     * specific class (and not, e.g. a class-or-subclass).
     */
    this._clazz = ((typeof clazzOrType) === 'function')
      ? TFunction.checkClass(clazzOrType)
      : null;

    /** {string} Name of the type which identifies qualified values. */
    this._type = (this._clazz !== null) ? 'instance' : TString.check(clazzOrType);

    /**
     * {function|null} Additional predicate that must be `true` of values for
     * them to qualify, if any.
     */
    this._predicate = TFunction.checkCallableOrNull(predicate);

    /** {function} Value encoder function. */
    this._encode = TFunction.checkCallable(encode);

    /** {function} Value decoder function. */
    this._decode = TFunction.checkCallable(decode);

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
   * encoded in "construction arguments" array form. This is `null` for a
   * "construction arguments" array form.
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
   * @param {*} payload Payload which resulted from an earlier call to
   *   `encode()` on this instance, or the equivalent thereto.
   * @param {function} subDecode Function to call to decode component values
   *   inside `payload`, as needed.
   * @returns {*} A value for which `canEncode()` on this instance would return
   *   `true`.
   */
  decode(payload, subDecode) {
    if (!this.canDecode(payload)) {
      log.error('Cannot decode:', payload);
      throw Errors.badValue(payload, 'encoded payload');
    }

    if (payload instanceof ConstructorCall) {
      // Extract the array of reconstruction arguments to pass to `_decode()`.
      payload = payload.payload.args;
    }

    const result = this._decode(payload, subDecode);

    if (!this.canEncode(result)) {
      log.error('Cannot re-encode:', result);
      throw Errors.badUse('Invalid result from decoder.');
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
   * @returns {*} Encoded payload, suitable for passing to `decode()` on this
   *   instance.
   */
  encode(value, subEncode) {
    if (!this.canEncode(value)) {
      log.error('Cannot encode:', value);
      throw Errors.badValue(value, 'encodable value');
    }

    const encodedType = this._encodedType;
    let   result      = this._encode(value, subEncode);

    // Validate the result, and in the case of normal "construction arguments"
    // arrays, wrap it in a single-key plain object, using the tag as the key.
    if (encodedType === null) {
      try {
        TArray.check(result);
      } catch (e) {
        // Throw a higher-fidelity error.
        log.error('Non-array encoding result:', result);
        throw Errors.badUse('Invalid encoding result (not an array).');
      }

      result = new ConstructorCall(new Functor(this._tag, ...result));
    } else if (ItemCodec.typeOf(result) !== encodedType) {
      log.error(`Unexpected encoding result (expected type ${encodedType}):`, result);
      throw Errors.badUse('Invalid encoding result: ' +
        `got type ${ItemCodec.typeOf(result)}; expected type ${encodedType}`);
    }

    return Object.freeze(result);
  }
}
