// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Delta from 'quill-delta';

import { TArray } from 'typecheck';
import { CommonBase, DataUtil, Errors, ObjectUtil } from 'util-common';

/**
 * {BodyDelta|null} Empty instance. Initialized in the static getter of the
 * same name.
 */
let EMPTY = null;

/**
 * Always-frozen list of body OT operations. This is a subclass of Quill's
 * `Delta` and mixes in `CommonBase` (the latter for `check()` and `coerce()`
 * functionality). In addition, it contains extra utility functionality beyond
 * what the base `Delta` provides.
 */
export default class BodyDelta extends Delta {
  /** {BodyDelta} Empty instance of this class. */
  static get EMPTY() {
    if (EMPTY === null) {
      EMPTY = new BodyDelta([]);
    }

    return EMPTY;
  }

  /**
   * Main coercion implementation, per the superclass documentation. In this
   * case, the following is how it proceeds:
   *
   * * If `value` is a `Delta`, returns an instance with the same list of
   *   ops.
   * * If `value` is an array, returns an instance with `value` as the list
   *   of ops.
   * * If `value` is an object that binds `ops`, returns an instance with
   *   `value.ops` as the list of ops.
   * * If `value` is `null` or `undefined`, returns `EMPTY`.
   * * Throws a `bad_value` error for any other value.
   *
   * In general, this method will return the unique instance `EMPTY` when
   * possible.
   *
   * Unlike the `Delta` constructor:
   *
   * * This method does not construct a new instance if the given value is in
   *   fact an instance of this class.
   * * The result is always deeply frozen.
   * * This method will throw an error instead of silently accepting invalid
   *   values.
   *
   * @param {object|array|null|undefined} value The value to coerce.
   * @returns {BodyDelta} The corresponding instance.
   */
  static _impl_coerce(value) {
    // Note: The base class implementation guarantees that we won't get called
    // on an instance of this class.
    if ((value === null) || (value === undefined)) {
      return BodyDelta.EMPTY;
    } else if (Array.isArray(value)) {
      return (value.length === 0) ? BodyDelta.EMPTY : new BodyDelta(value);
    } else if ((value instanceof Delta) || Array.isArray(value.ops)) {
      const ops = value.ops;
      return (ops.length === 0) ? BodyDelta.EMPTY : new BodyDelta(ops);
    }

    throw Errors.bad_value(value, BodyDelta);
  }

  /**
   * Constructs an instance.
   *
   * @param {array<object>} ops The transformation operations of this instance.
   *   If not deeply frozen, the actual stored `ops` will be a deep-frozen clone
   *   of the given value.
   */
  constructor(ops) {
    // **TODO:** The contents of `ops` should be validated.
    TArray.check(ops);

    super(DataUtil.deepFreeze(ops));
    Object.freeze(this);
  }

  /**
   * Compares this to another possible-instance, for equality. To be considered
   * equal, `other` must be an instance of this class with an `ops` which is
   * `DataUtil.equalData()` to this instance's `ops`.
   *
   * @param {*} other Instance to compare to.
   * @returns {boolean} `true` if `this` and `other` are equal, or `false` if
   *   not.
   */
  equals(other) {
    if (this === other) {
      return true;
    }

    return (other instanceof BodyDelta)
      && DataUtil.equalData(this._ops, other._ops);
  }

  /**
   * Returns `true` iff this instance has the form of a "document," or put
   * another way, iff it is valid to compose with an empty snapshot. In Quill
   * terms, a document is a delta that consists _only_ of `insert` operations.
   *
   * @returns {boolean} `true` if this instance is a document or `false` if not.
   */
  isDocument() {
    for (const op of this.ops) {
      if (!ObjectUtil.hasOwnProperty(op, 'insert')) {
        return false;
      }
    }

    return true;
  }

  /**
   * Returns `true` iff this instance is empty (that is, it has an empty list
   * of ops).
   *
   * @returns {boolean} `true` if this instance is empty or `false` if not.
   */
  isEmpty() {
    return this.ops.length === 0;
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this.ops];
  }
}

// Add `CommonBase` as a mixin, because the main inheritence is the `Delta`
// class.
CommonBase.mixInto(BodyDelta);
