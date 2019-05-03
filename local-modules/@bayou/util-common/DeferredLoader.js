// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TFunction, TString } from '@bayou/typecheck';
import { Errors } from '@bayou/util-common';

import { BaseProxyHandler } from './BaseProxyHandler';

/**
 * Creator of "deferred loaders," in the form of a proxy handler class. A
 * deferred loader instance is a proxy which is initially "empty," and then
 * becomes populated the first time an attempt is made to access it. During the
 * first access, it calls on a loader function to load up the "real" target, and
 * then it uses that target for all accesses.
 *
 * The easiest way to use this class is via the {@link
 # BaseProxyHandler#makeProxy()} static method.
 *
 * The point of this class is to help break module dependency cycles. By using
 * this class, it is possible to effectively "import" a module just before it is
 * used, which can be _after_ it is fully initialized. This makes it so that the
 * imported module can actually depend on the module doing the loading (as long
 * as it doesn't _immediately_ use circularly-depended functionality).
 */
export class DeferredLoader extends BaseProxyHandler {
  /**
   * Constructs an instance.
   *
   * @param {string} label Label to use when reporting errors.
   * @param {function} loaderFunction Target loader function.
   */
  constructor(label, loaderFunction) {
    super();

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
   * @param {string|Symbol} property Name of the property (or method) to get.
   * @param {object} receiver_unused The original message receiver (which is
   *   always `this` in this case).
   * @returns {*} The value of the named property in the target object.
   */
  get(target_unused, property, receiver_unused) {
    let target = this._target;

    if (target === null) {
      // This is the first time we've been asked to get a property.
      try {
        target = this._loaderFunction();

        const type = typeof target;
        if ((target === null) || ((type !== 'object') && (type !== 'function'))) {
          target = Errors.badUse(`Loader for ${this._label} object returned an invalid value.`);
        }
      } catch (e) {
        target = Errors.badUse(e, `Error in loader for ${this._label} object.`);
      }

      this._target = target; // Either the valid value or the error to throw.
    }

    if (target instanceof Error) {
      // There was trouble getting the target, either immediately above or on
      // an earlier call.
      throw target;
    }

    const result = target[property];

    if (result === undefined) {
      throw Errors.badUse(`Missing property: ${this._label}.${property}`);
    }

    return result;
  }
}
