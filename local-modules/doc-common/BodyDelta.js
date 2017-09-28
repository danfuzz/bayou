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
   * * Throws a `bad_value` error for any other value.
   *
   * In general, this method will return the unique instance `EMPTY` when
   * possible.
   *
   * Unlike the `Delta` constructor:
   *
   * * The result is always deeply frozen.
   * * This method will throw an error instead of silently accepting invalid
   *   values.
   * * This does not accept arbitrary objects that just happen to have an `ops`
   *   field.
   *
   * @param {object|array|null|undefined} value The value to coerce.
   * @returns {BodyDelta} The corresponding instance.
   */
  static _impl_coerce(value) {
    // **Note:** The base class implementation guarantees that we won't get
    // called on an instance of this class.

    let ops;
    if (Array.isArray(value)) {
      ops = value;
    } else if (value instanceof Delta) {
      ops = value.ops;
    } else {
      // Invalid argument. Diagnose further.
      if ((typeof value === 'object') && value.constructor && (value.constructor.name === 'Delta')) {
        // The version of `Delta` used by Quill is different than the one we
        // specified in our `package.json`. Even though it will often happen to
        // work if we just let it slide (e.g. by snarfing `ops` out of the
        // object and running with it), we don't want to end up shipping two
        // versions of `Delta` to the client; so, instead of just blithely
        // accepting this possibility, we reject it here and report an error
        // which makes it easy to figure out what happened. Should you find
        // yourself looking at this error, the right thing to do is look at
        // Quill's `package.json` and update the `quill-delta` dependency here
        // to what you find there.
        throw Errors.bad_use('Divergent versions of `quill-delta` package.');
      } else {
        throw Errors.bad_value(value, BodyDelta);
      }
    }

    return (ops.length === 0) ? BodyDelta.EMPTY : new BodyDelta(ops);
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
