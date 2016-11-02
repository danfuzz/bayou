// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Delta from 'quill-delta';

/** Immutable empty `Delta` instance. */
const EMPTY_DELTA = Object.freeze(new Delta());
Object.freeze(EMPTY_DELTA.ops);

/**
 * Quill `Delta` helper utilities.
 */
export default class DeltaUtil {
  /** Immutable empty `Delta` instance. */
  static get EMPTY_DELTA() {
    return EMPTY_DELTA;
  }

  /**
   * Returns `true` iff the given delta is empty. This accepts the same set of
   * values as `coerce()`, see which. Anything else is considered to be an
   * error.
   *
   * @param delta (null-ok) The delta or delta-like value.
   * @returns `true` if `delta` is empty or `false` if not.
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

    throw new Error('Invalid value.');
  }

  /**
   * Coerces the given value to a `Delta`.
   *
   * * If `value` is a `Delta`, returns `value`.
   * * If `value` is an array, constructs a `Delta` with `value` as the list of
   *   ops.
   * * If `value` is an object that binds `ops`, constructs a `Delta` with
   *   `value.ops` as the list of ops.
   * * If `value` is `null` or `undefined`, returns an empty `Delta`.
   * * Throws an error for any other value.
   *
   * Unlike the `Delta` constructor:
   *
   * * This method does not construct a new instance if the given value is in
   *   fact a `Delta`.
   * * This method will throw an error instead of silently accepting invalid
   *   values.
   *
   * @param value (null-ok) The value to coerce to a `Delta`.
   * @returns the corresponding `Delta`.
   */
  static coerce(value) {
    if (value instanceof Delta) {
      return value;
    } else if (DeltaUtil.isEmpty(value)) {
      return EMPTY_DELTA;
    } else if (Array.isArray(value)) {
      return new Delta(value);
    } else if (Array.isArray(value.ops)) {
      return new Delta(value.ops);
    }

    throw new Error('Invalid value.');
  }
}
