// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { TBoolean, TInt, TString } from '@bayou/typecheck';
import { CommonBase, Errors, Functor } from '@bayou/util-common';

/**
 * Base class for OT operations. Instances of concrete subclasses of this class
 * are what compose the main contents of a corresponding concrete {@link
 * BaseDelta} subclasses.
 *
 * **Note:** Each concrete subclass of this class needs to define a set of
 * static properties with names of the form `CODE_<name>`, each of which has a
 * string value. These values are collectively taken to be the acceptable opcode
 * names for use with the concrete subclass.
 */
export class BaseOp extends CommonBase {
  /**
   * Validates a {@link Functor} to be used as the payload for an instance of
   * this class.
   *
   * @param {Functor} payload The would-be payload for an instance.
   * @returns {Functor} `payload`, if it turns out to be valid.
   * @throws {Error} Thrown if `payload` is invalid.
   */
  static checkPayload(payload) {
    if (this.isValidPayload(payload)) {
      return payload;
    }

    throw Errors.badUse(`Invalid payload for ${this.name}: ${inspect(payload)}`);
  }

  /**
   * Indicates whether the given name is acceptable for use as an opcode name
   * on an instance of this class.
   *
   * **Note:** This depends on the set of `CODE_*` properties being correct for
   * the concrete subclass.
   *
   * @param {string} name Potential opcode name.
   * @returns {boolean} `true` if `name` is valid for use as an opcode name on
   *   this class, or `false` if not.
   */
  static isValidName(name) {
    TString.check(name);

    if (!this._names) {
      // First time this method has been called on the concrete subclass;
      // collect all the names.

      const names = new Set();
      const descs = Object.getOwnPropertyDescriptors(this);

      for (const [propName, desc] of Object.entries(descs)) {
        if (!/^CODE_/.test(propName)) {
          continue;
        }

        const value = TString.nonEmpty(desc.get ? desc.get() : desc.value);
        names.add(value);

        if (names.size === 0) {
          throw new Errors.wtf(`No \`CODE_*\` properties found on ${this.name}.`);
        }
      }

      this._names = Object.freeze(names);
    }

    return this._names.has(name);
  }

  /**
   * Validates a {@link Functor} to be used as the payload for an instance of
   * this class, returning a `boolean` indicating validity.
   *
   * @param {Functor} payload The would-be payload for an instance.
   * @returns {boolean} `true` if `payload` is valid, or `false` if not.
   */
  static isValidPayload(payload) {
    if (!this.isValidName(payload.name)) {
      return false;
    }

    const result = this._impl_isValidPayload(payload);

    return TBoolean.check(result);
  }

  /**
   * Constructs an instance. This should not be used directly. Instead, use
   * the static constructor methods defined by concrete subclasses of this
   * class.
   *
   * @param {string} name The operation name.
   * @param {...*} args The operation arguments. Each argument must either be
   *   frozen or be a data values which _can_ be frozen. In the latter case, the
   *   resulting instance's corresponding argument is a deep-frozen clone of the
   *   value given here.
   */
  constructor(name, ...args) {
    super();

    // Perform syntactic validation based on the concrete subclass.
    const payload = new Functor(name, ...args).withFrozenArgs();
    this.constructor.checkPayload(payload);

    /** {Functor} The operation payload (name and arguments). */
    this._payload = payload;

    Object.freeze(this);
  }

  /** {Functor} The operation payload (name and arguments). */
  get payload() {
    return this._payload;
  }

  /**
   * {Int} The "rough size" of the op, in terms of storage requirements in
   * working memory or stable storage. This is _not_ a guaranteed size, nor does
   * it have a defined unit. It is merely meant for apples-to-apples comparisons
   * (and mostly for doing so in the aggregate). This value is always a positive
   * integer.
   */
  get roughSize() {
    return TInt.min(this._impl_roughSize, 1);
  }

  /**
   * Gets reconstruction arguments for this instance.
   *
   * @returns {array<*>} Reconstruction arguments.
   */
  deconstruct() {
    return [this._payload.name, ...this._payload.args];
  }

  /**
   * Compares this to another possible-instance, for equality of content. In
   * order to be considered equal to `this`, `other` must be an instance of the
   * same concrete class and have a payload which is `.equals()` to this
   * instance's payload.
   *
   * @param {*} other Value to compare to.
   * @returns {boolean} `true` iff `this` and `other` are equal.
   */
  equals(other) {
    if (this === other) {
      return true;
    } else if (!(other instanceof BaseOp)) {
      // **Note:** This handles non-objects and `null`s, making the `return`
      // expression below pretty straightforward.
      return false;
    }

    return (this.constructor === other.constructor)
      && this._payload.equals(other._payload);
  }

  /**
   * {Int} Main implementation of {@link #roughSize}. Subclasses must fill this
   * in.
   *
   * @abstract
   */
  get _impl_roughSize() {
    return this._mustOverride();
  }

  /**
   * Main implementation of {@link #isValidPayload}. Subclasses must fill this
   * in.
   *
   * @abstract
   * @param {Functor} payload The would-be payload for an instance.
   * @returns {boolean} `true` if `payload` is valid, or `false` if not.
   */
  static _impl_isValidPayload(payload) {
    return this._mustOverride(payload);
  }
}
