// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Delta from 'quill-delta';

import FrozenDelta from './FrozenDelta';

/**
 * Quill `Delta` helper utilities.
 */
export default class DeltaUtil {
  /**
   * Coerces the given value to a frozen (immutable) `Delta`.
   *
   * * If `value` is a frozen `Delta`, returns `value`.
   * * If `value` is a `Delta`, constructs a frozen `Delta` with the same list
   *   of ops.
   * * If `value` is an array, constructs a frozen `Delta` with `value` as the
   *   list of ops.
   * * If `value` is an object that binds `ops`, constructs a frozen `Delta`
   *   with `value.ops` as the list of ops.
   * * If `value` is `null` or `undefined`, returns an empty frozen `Delta`.
   * * Throws an error for any other value.
   *
   * Unlike the `Delta` constructor:
   *
   * * This method does not construct a new instance if the given value is in
   *   fact a frozen `Delta`.
   * * The result is always deeply frozen.
   * * This method will throw an error instead of silently accepting invalid
   *   values.
   *
   * @param {*} value The value to coerce to a `Delta`.
   * @returns {FrozenDelta} The corresponding `Delta`.
   */
  static coerce(value) {
    if (value instanceof FrozenDelta) {
      return value;
    } else if (value instanceof Delta) {
      return new FrozenDelta(value.ops);
    } else if (FrozenDelta.isEmpty(value)) {
      return FrozenDelta.EMPTY;
    } else if (Array.isArray(value)) {
      return new FrozenDelta(value);
    } else if (Array.isArray(value.ops)) {
      return new FrozenDelta(value.ops);
    }

    throw new Error('Invalid value.');
  }
}
