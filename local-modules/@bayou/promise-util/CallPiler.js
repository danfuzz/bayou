// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TFunction } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

/**
 * Function wrapper that guarantees only one call to the underlying function
 * will be active (via this instance) at any given time, and which will
 * "dogpile" concurrent calls on the existing call. This is useful for avoiding
 * making multiple long-running asynchronous calls, in cases where it doesn't
 * matter if a different number of calls to the function were made and where the
 * results from a call are reasonably shared to more than one caller.
 *
 * For example, the following code:
 *
 * ```
 * let x = 0;
 * async function blort() {
 *   console.log('Blort!');
 *   x++;
 *   return x;
 * }
 * const piler = new CallPiler(blort);
 * const call1 = piler.call();
 * const call2 = piler.call();
 * console.log('Results', await call1, await call2);
 * const call3 = piler.call();
 * const call4 = piler.call();
 * console.log('Results', await call3, await call4);
 * ```
 *
 * will print the following when run:
 *
 * ```
 * Blort!
 * Results 1 1
 * Blort!
 * Results 2 2
 * ```
 */
export class CallPiler extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {function} func Function to call.
   * @param {...*} args Arguments to pass to the function.
   */
  constructor(func, ...args) {
    super();

    /** {function} Function to call. */
    this._func = TFunction.checkCallable(func);

    /** {array<*>} Arguments to pass to the function. */
    this._args = args;

    /**
     * {Promise|null} Promise for the result from the currently-executing call,
     * if any, or `null` if there is no call currently in progress.
     */
    this._resultProm = null;

    Object.seal(this);
  }

  /**
   * Calls the wrapped function asynchronously, if a call isn't already in
   * progress, or returns the promised result of a call that's already running.
   *
   * @returns {*} The result of calling the wrapped function.
   */
  async call() {
    if (this._resultProm === null) {
      // No call currently in progress. Make one.
      this._resultProm = this._doCall();
    }

    // Arrange to clean up the pending result promise once it becomes resolved.

    const resultProm = this._resultProm;

    try {
      return (await resultProm);
    } finally {
      // Only `null` out the pending result if it hasn't already been replaced
      // with another one.
      if (this._resultProm === resultProm) {
        this._resultProm = null;
      }
    }
  }

  /**
   * Makes a call to the wrapped function, asynchronously.
   *
   * @returns {*} Result from the wrapped call.
   */
  async _doCall() {
    // Grab `this._func` into a local to make calling it _not_ be a method call.
    const func = this._func;
    return func(...(this._args));
  }
}
