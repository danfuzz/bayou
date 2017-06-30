// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import CommonBase from './CommonBase';

/**
 * Promise-based mutex implementation. This provides _non-reentrant_ mutual
 * exclusion. This class can be used to serialize running of critical sections
 * of code, among other things.
 */
export default class PromMutex extends CommonBase {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    /**
     * {Symbol|null} Unique symbol representing the current lock holder, or
     * `null` if the lock is not currently held. This symbol serves as the "key"
     * for unlocking, such that only the current lock holder can unlock the
     * instance.
     */
    this._lockedBy = null;

    /**
     * {Array<object>} Array of waiters for lock acquisition, in FIFO order.
     * Each element binds `key` to the would-be holder key (see `_lockedBy`) and
     * `release` to a function which indicates that the key's owner can now
     * acquire the lock.
     */
    this._waiters = [];

    Object.seal(this);
  }

  /**
   * Acquires the mutual exclusion lock. This method returns only after the
   * lock has been released by all previous lock requesters. The return value is
   * a function which, when called, releases the lock and so allows other
   * threads of control to get the lock.
   *
   * @returns {Function} Function of no arguments which releases the lock when
   *   called.
   */
  async lock() {
    const key = Symbol('mutex-key'); // Uninterned symbol and so unique.

    if (this._lockedBy !== null) {
      // There's contention, so we have to queue up. The `release` function
      // queued up here gets called inside the returned unlock function below.
      const released = new Promise((res, rej_unused) => {
        const release = () => { res(true); };
        this._waiters.push({ key, release });
      });

      await released;
      this._waiters = this._waiters.shift();
    }

    this._lockedBy = key;

    // The return value is the unlock function.
    return () => {
      if (this._lockedBy !== key) {
        throw new Error('Attempt to unlock by non-owner.');
      }

      this._lockedBy = null;

      if (this._waiters.length !== 0) {
        // Release the next queued up waiter.
        this._waiters[0].release();
      }
    };
  }
}
