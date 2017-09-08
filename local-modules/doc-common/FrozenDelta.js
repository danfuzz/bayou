// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Delta from 'quill-delta';

import { TArray, TypeError } from 'typecheck';
import { CommonBase, DataUtil, ObjectUtil } from 'util-common';

/**
 * {FrozenDelta|null} Empty instance. Initialized in the `EMPTY` property
 * accessor.
 */
let emptyInstance = null;

/**
 * Always-frozen `Delta`. This is a subclass of `Delta` and mixes in
 * `CommonBase` (the latter for `check()` and `coerce()` functionality). In
 * addition, it contains extra utility functionality beyond what the base
 * `Delta` provides.
 */
export default class FrozenDelta extends Delta {
  /** {string} Name of this class for the sake of API coding. */
  static get API_TAG() {
    return 'Delta';
  }

  /** {FrozenDelta} Empty instance of this class. */
  static get EMPTY() {
    if (emptyInstance === null) {
      emptyInstance = new FrozenDelta([]);
    }

    return emptyInstance;
  }

  /**
   * Returns `true` iff the given delta or delta-like value is empty. This
   * accepts the same set of values as `coerce()`, see which. Anything else is
   * considered to be an error, except that when not given a `Delta` per se the
   * array contents (if any) are not inspected for validity.
   *
   * **Note:** This is a static method exactly because it accepts things other
   * than instances of `FrozenDelta` per se.
   *
   * @param {object|array|null|undefined} delta The delta or delta-like value.
   * @returns {boolean} `true` if `delta` is empty or `false` if not.
   */
  static isEmpty(delta) {
    if (delta instanceof Delta) {
      return (delta.ops.length === 0);
    } else if ((delta === null) || (delta === undefined)) {
      return true;
    } else if (Array.isArray(delta)) {
      return delta.length === 0;
    } else if ((typeof delta === 'object') && Array.isArray(delta.ops)) {
      return delta.ops.length === 0;
    }

    return TypeError.badValue(delta, 'FrozenDelta');
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
   * * Throws a `TypeError` for any other value.
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
   * @returns {FrozenDelta} The corresponding instance.
   */
  static _impl_coerce(value) {
    // Note: The base class implementation guarantees that we won't get called
    // on an instance of this class.
    if (FrozenDelta.isEmpty(value)) {
      return FrozenDelta.EMPTY;
    } else if (value instanceof Delta) {
      return new FrozenDelta(value.ops);
    } else if (Array.isArray(value)) {
      return new FrozenDelta(value);
    } else if (Array.isArray(value.ops)) {
      return new FrozenDelta(value.ops);
    }

    return TypeError.badValue(value, 'FrozenDelta');
  }

  /**
   * Constructs an instance.
   *
   * @param {array<object>} ops The transformation operations of this instance.
   *   If not deeply frozen, the actual stored `ops` will be a deep-frozen clone
   *   of the given value.
   */
  constructor(ops) {
    // TODO: Should consider validating the contents of `ops`.
    TArray.check(ops);

    super(DataUtil.deepFreeze(ops));
    Object.freeze(this);
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this.ops];
  }

  /**
   * Returns `true` iff this instance has the form of a "document." In Quill
   * terms, a "document" is a delta that consists _only_ of `insert` operations.
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
}

// Add `CommonBase` as a mixin, because the main inheritence is the `Delta`
// class.
CommonBase.mixInto(FrozenDelta);
