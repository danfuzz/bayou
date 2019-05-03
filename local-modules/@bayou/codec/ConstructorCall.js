// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase, Errors, Functor, ObjectUtil } from '@bayou/util-common';

/**
 * Representation of a "constructor call" encoded data form. Instances of this
 * class are used as the representation of class instances in the structured
 * values produced by {@link Codec#encode} and accepted by {@link Codec#decode}.
 * Instances of this class are always frozen (immutable).
 */
export class ConstructorCall extends CommonBase {
  /**
   * Reviver function suitable for use with `JSON.parse()`, which handles
   * conversion of the JSON encoding form as defined by this module into
   * instances of this class, when appropriate. It passes arrays, `null`, and
   * non-objects through as-is. It rejects (throws an error when given) any
   * objects not in the JSON encoding form.
   *
   * **Note:** The arguments of this function are specified by JavaScript, as
   * part of the contract for `JSON.parse()`.
   *
   * @param {string|number} key_unused Key to which the value in question will
   *   be bound, or `''` if there is no salient key.
   * @param {*} value Value being revived.
   * @returns {*} Revived value.
   */
  static revive(key_unused, value) {
    if (   (value === null)
        || (typeof value !== 'object')
        || Array.isArray(value)) {
      return value;
    }

    const [[tag, args], ...rest] = Object.entries(value);

    if (!(   ObjectUtil.isPlain(value)
          && (rest.length === 0)
          && Array.isArray(args))) {
      throw Errors.badData('Invalid object in encoded form.');
    }

    return new ConstructorCall(new Functor(tag, ...args));
  }

  /**
   * Constructs an instance from individual name and arguments elements, instead
   * of from a full {@link Functor}. This is just convenient wrapper which calls
   * `new ConstructorCall(new Functor(...args))`.
   *
   * @param {...*} args Arguments to pass to the {@link Functor} constructor
   *  (which expects a string name followed by zero or more arbitrary
   *  additional arguments).
   * @returns {ConstructorCall} An appropriately-constructed instance of this
   *   class.
   */
  static from(...args) {
    return new ConstructorCall(new Functor(...args));
  }

  /**
   * Constructs an instance.
   *
   * @param {Functor} payload Construction payload. It is a functor whose name
   *   indicates which class (or class-like-thing) to construct and whose
   *   arguments are to be passed to the salient constructor function.
   */
  constructor(payload) {
    super();

    /** {Functor} Construction payload. */
    this._payload = Functor.check(payload);

    Object.freeze(this);
  }

  /** {Functor} Construction payload. */
  get payload() {
    return this._payload;
  }

  /**
   * Gets the JSON encoding form of this instance. See {@link Codec#encodeJson}
   * for details.
   *
   * **Note:** The name of this method is specified by JavaScript, as part of
   * the contract for `JSON.stringify()`.
   *
   * @returns {object} The JSON encoding form.
   */
  toJSON() {
    const payload = this._payload;

    return { [payload.name]: payload.args };
  }
}
