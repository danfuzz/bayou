// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { TArray, TBoolean, TObject } from 'typecheck';
import { CommonBase } from 'util-common';


/**
 * Base class for document deltas. These are ordered lists of operations which
 * indicate how to take one document state and transform it into a new document
 * state. Subclasses of this class specialize on particular aspects of a
 * (larger) document.
 *
 * Instances of (subclasses of) this class are used as the main payload data for
 * the various "change" and "snapshot" classes.
 *
 * Instances of this class are immutable.
 */
export default class BaseDelta extends CommonBase {
  /**
   * {BaseDelta} Empty instance of this class, that is, an instance whose `ops`
   * is an empty array (`[]`). This is a direct instance of whatever class this
   * is accessed on (and not just a `BaseDelta` per se).
   */
  static get EMPTY() {
    // **Note:** `this` in the context of a static method is the class, not an
    // instance.

    if (!this._EMPTY) {
      this._EMPTY = new this([]);
    }

    return this._EMPTY;
  }

  /**
   * {class} Class (constructor function) of operation objects to be used with
   * instances of this class.
   */
  static get opClass() {
    // **Note:** `this` in the context of a static method is the class, not an
    // instance.

    if (!this._opClass) {
      // Call the `_impl` and verify the result.
      const clazz = this._impl_opClass;

      TObject.check(clazz.prototype, CommonBase); // **TODO:** Should be `BaseOp`.
      this._opClass = clazz;
    }

    return this._opClass;
  }

  /**
   * Checks the given value to see if it is a valid array of operations for use
   * with this class. This does _not_ check to see if the array is frozen.
   *
   * @param {*} value The alleged operation.
   * @returns {array<object>} `value` if it is indeed valid.
   * @throws {Error} if `value` is not valid.
   */
  static checkOpArray(value) {
    // **Note:** `this` in the context of a static method is the class, not an
    // instance.
    return TArray.check(value, this.opClass.check);
  }

  /**
   * Constructs an instance.
   *
   * @param {array<object>} ops Array of operations. Each operation must be an
   *   instance of {@link opClass}. If not passed as a frozen array, the
   *   constructed instance will instead store a frozen clone of this value.
   */
  constructor(ops) {
    super();

    if (!Object.isFrozen(ops)) {
      ops = Object.freeze(ops.slice());
    }

    /** {array<object>} Array of operations. */
    this._ops = this.constructor.checkOpArray(ops);

    Object.freeze(this);
  }

  /**
   * {array<object>} Array of operations to be applied. This is guaranteed to
   * be a frozen (immutable) value.
   */
  get ops() {
    return this._ops;
  }

  /**
   * Compares this to another possible-instance, for equality. To be considered
   * equal:
   *
   * * `other` must be an instance of the same direct class as `this`.
   * * The two instance's `ops` arrays must be the same length.
   * * Corresponding `ops` elements must be `.equals()`.
   *
   * Subclasses may override this method if this behavior isn't right for them.
   *
   * @param {*} other Instance to compare to.
   * @returns {boolean} `true` if `this` and `other` are equal, or `false` if
   *   not.
   */
  equals(other) {
    if (this === other) {
      return true;
    } else if (!(other instanceof BaseDelta)) {
      // **Note:** This handles non-objects and `null`s, making the next
      // pair of checks (below) more straightforward.
      return false;
    }

    const thisOps  = this._ops;
    const otherOps = other._ops;

    if (   (this.constructor !== other.constructor)
        || (thisOps.length !== otherOps.length)) {
      return false;
    }

    for (let i = 0; i < thisOps.length; i++) {
      if (!thisOps[i].equals(otherOps[i])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Returns `true` iff this instance has the form of a "document," or put
   * another way, iff it is valid to compose with an instance which represents
   * an empty snapshot. The details of what makes an instance a document vary
   * from subclass to subclass.
   *
   * @returns {boolean} `true` if this instance can be used as a document or
   *   `false` if not.
   */
  isDocument() {
    // **TODO:** Consider caching the results of this call, if it turns out to
    // be common for it to be called many times on the same object.
    const result = this._impl_isDocument();

    return TBoolean.check(result);
  }

  /**
   * Returns `true` iff this instance is empty. An empty instance is defined as
   * one whose `ops` array has no elements.
   *
   * @returns {boolean} `true` if this instance is empty, or `false` if not.
   */
  isEmpty() {
    return this._ops.length === 0;
  }

  /**
   * Converts this instance to codec reconstruction arguments.
   *
   * @returns {array} Reconstruction arguments.
   */
  toCodecArgs() {
    return [this._ops];
  }

  /**
   * Gets a human-oriented string representation of this instance.
   *
   * @returns {string} The human-oriented representation.
   */
  toString() {
    const name = this.constructor.name;
    const body = inspect(this._ops);

    return `${name} ${body}`;
  }

  /**
   * Main implementation of {@link #isDocument}. Subclasses must fill this in.
   *
   * @abstract
   * @returns {boolean} `true` if this instance can be used as a document or
   *   `false` if not.
   */
  _impl_isDocument() {
    return this._mustOverride();
  }

  /**
   * {class} Class (constructor function) of operation objects to be used with
   * instances of this class.
   *
   * @abstract
   */
  static get _impl_opClass() {
    return this._mustOverride();
  }
}
