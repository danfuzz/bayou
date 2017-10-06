// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase, Functor } from 'util-common';

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
   * @param {Functor} payload The operation payload (name and arguments). All
   *   arguments must either be frozen or be data values which _can_ be frozen.
   *   In the latter case, the resulting instance's payload is a deep-frozen
   *   clone of the value given here.
   */
  constructor(payload) {
    super();

    /** {Functor} payload The operation payload (name and arguments). */
    this._payload = Functor.check(payload).withFrozenArgs();

    Object.freeze(this);
  }

  /** {Functor} The operation payload (name and arguments). */
  get payload() {
    return this._payload;
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
   * Converts this instance to codec reconstruction arguments.
   *
   * @returns {array} Reconstruction arguments.
   */
  toCodecArgs() {
    return [this._payload];
  }

  /**
   * Gets a human-oriented string representation of this instance.
   *
   * @returns {string} The human-oriented representation.
   */
  toString() {
    return `${this.constructor.name} { ${this._payload} }`;
  }
}
