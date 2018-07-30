// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase, Functor } from '@bayou/util-common';

/**
 * Base class for OT operations. Instances of concrete subclasses of this class
 * are what compose the main contents of a corresponding concrete {@link
 * BaseDelta} subclasses.
 */
export default class BaseOp extends CommonBase {
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

    // Perform syntactic validation based on subclass
    this._impl_validate(name, args);

    /** {Functor} The operation payload (name and arguments). */
    this._payload = new Functor(name, ...args).withFrozenArgs();

    Object.freeze(this);
  }

  /** {Functor} The operation payload (name and arguments). */
  get payload() {
    return this._payload;
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
   * Abstract function to alidates op arguments based on
   * op subclass. Subclasses must implement their own validation.
   *
   * @param {string} name The name of the op type.
   * @param {array} args The op arguments to validate.
   * @returns {boolean} `true` if arguments are valid,
   *   throws and error otherwise.
   * @abstract
   */
  _impl_validate(name, args) {
    return this._mustOverride(name, args);
  }
}
