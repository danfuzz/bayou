// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * Promise that is permanently resolved as `true`. Used as a result from
 * `when*()`.
 */
const RESOLVED_TRUE = Promise.resolve(true);

/**
 * Boolean condition with promise-attached level triggers.
 */
export default class PromCondition {
  /**
   * Constructs an instance.
   *
   * @param value Initial value; defaults to `false`.
   */
  constructor(initialValue) {
    initialValue = PromCondition._ensureBoolean(initialValue, false);

    /** Current value. */
    this._value = initialValue;

    /**
     * Promises which get resolved when `_value` is `false` (index `0`) or
     * `true` (index `1`). Will be `null` for both indexes when there are no
     * waiters. Will only ever be non-null for one index at a time. When
     * non-null, the corresponding element of `_trigger` is the resolver for
     * the promise.
     */
    this._became = [null, null];

    /**
     * Trigger functions corresponding to `_became`. Elements are only non-null
     * when there is a corresponding waiter.
     */
    this._trigger = [null, null];
  }

  /** The current value. */
  get value() {
    return this._value;
  }

  /**
   * Sets the current value. Can cause waiters to stop waiting should the
   * value change.
   */
  set value(value) {
    value = PromCondition._ensureBoolean(value);

    if (value === this._value) {
      // No change.
      return;
    }

    const idx = value ? 1 : 0;
    this._value = value;

    if (this._trigger[idx]) {
      this._trigger[idx](true);
      this._trigger[idx] = null;
      this._became[idx] = null;
    }
  }

  /**
   * Returns a promise which becomes resolved to `true` when the value of this
   * instance becomes `true`. If the value is already `true` then the return
   * value is an already-resolved promise.
   *
   * **Note:** Once resolved, the result will never become _un_-resolved should
   * the condition change state again. That is, you can't cache a return value
   * from this method and expect it to work for any later state changes.
   */
  whenTrue() {
    return this._whenX(true);
  }

  /**
   * Returns a promise which becomes resolved to `true` when the value of this
   * instance becomes `false`. If the value is already `true` then the return
   * value is an already-resolved promise.
   *
   * **Note:** Once resolved, the result will never become _un_-resolved should
   * the condition change state again. That is, you can't cache a return value
   * from this method and expect it to work for any later state changes.
   */
  whenFalse() {
    return this._whenX(false);
  }

  /**
   * Common implementation of `whenTrue()` and `whenFalse()`.
   */
  _whenX(value) {
    if (this._value === value) {
      // Value is already as desired.
      return RESOLVED_TRUE;
    }

    const idx = value ? 1 : 0;
    if (!this._became[idx]) {
      // There's not yet a promise. That is, there aren't yet any other waiters.
      // Make it, and hook up the corresponding trigger.
      this._became[idx] = new Promise((res, rej) => {
        this._trigger[idx] = res;
      });
    }

    return this._became[idx];
  }

  /**
   * Checks a boolean for sanity. Throws an error when insane. Returns the
   * value.
   *
   * @param value The (alleged) boolean.
   * @param defaultValue Optional default value. If passed, indicates that
   *   `undefined` should be treated as that value. If not passed, `undefined`
   *   is an error.
   * @returns `value` or `defaultValue`
   */
  static _ensureBoolean(value, defaultValue) {
    if ((value === undefined) && (defaultValue !== undefined)) {
      value = defaultValue;
    }

    if (typeof value !== 'boolean') {
      throw new Error(`Bad boolean: ${value}`);
    }

    return value;
  }
}
