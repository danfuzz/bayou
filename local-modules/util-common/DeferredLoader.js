// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TFunction, TString } from 'typecheck';

/**
 * Proxy handler for deferred loaders.
 */
class DeferredLoaderHandler {
  /**
   * Constructs an instance.
   *
   * @param {string} label Label to use when reporting errors.
   * @param {function} loaderFunction Target loader function.
   */
  constructor(label, loaderFunction) {
    /** {string} Label to use when reporting errors. */
    this._label = TString.nonEmpty(label);

    /** {function} Function to use to effect loading of the target object. */
    this._loaderFunction = TFunction.checkCallable(loaderFunction);

    /**
     * {object|null} The real target object. It becomes non-null on the first
     * access via this (proxy handler) instance.
     */
    this._target = null;
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy's target (which is always a frozen
   *   empty object in this case).
   * @param {string} property Name of the property (or method) to get.
   * @param {object} receiver_unused The original message receiver (which is
   *   always `this` in this case).
   * @returns {*} The value of the named property in the target object.
   */
  get(target_unused, property, receiver_unused) {
    let target = this._target;
    if (target === null) {
      target = this._target = this._loaderFunction();
      const type = typeof target;
      if (!((type === 'function') || ((type === 'object') && (target !== null)))) {
        throw new Error(`Failed to load ${this._label} object.`);
      }
    }

    const result = this._target[property];

    if (result === undefined) {
      throw new Error(`Missing ${this._label}: ${property}`);
    }

    return result;
  }
}

/**
 * Creator of "deferred loaders." An delayed loader instance is a proxy which
 * is initially "empty" until the first time an attempt is made to access it.
 * During the first access, it calls on a loader to load up the "real" target,
 * and then it uses that target for all accesses.
 *
 * The way to use this class is via the `makeProxy()` static method (see which).
 *
 * The point of this class is to help break module dependency cycles. By using
 * a proxy created by this class, it is possible to effectively "import" a
 * module just before it is used, which can be _after_ it is fully initialized.
 * This makes it so that the imported module can actually depend on the module
 * doing the loading (as long as it doesn't _immediately_ use
 * circularly-depended functionality).
 */
export default class DeferredLoader {
  /**
   * Makes a deferred loader proxy.
   *
   * @param {string} label Label to use when reporting errors.
   * @param {function} loaderFunction Function to call in order to perform the
   *   loading of the target. Expected to return the target.
   * @returns {Proxy} A deferred loader proxy.
   */
  static makeProxy(label, loaderFunction) {
    return new Proxy(
      Object.freeze({}),
      new DeferredLoaderHandler(label, loaderFunction));
  }
}
