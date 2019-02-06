// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase, Errors } from '@bayou/util-core';

/**
 * Base class for proxy handlers, which implements all methods in the most
 * "no-oppy" way possible. By default, if a proxy handler doesn't implement a
 * method, the equivalent operation is attempted on the proxy target. This
 * class explicitly implements _all_ proxy handler methods, so subclasses can be
 * sure that the target is only accessed if code in the subclass explicitly
 * allows it. The _one_ exception is that {@link #getPrototypeOf} per spec needs
 * to return the prototype of the target when {@link #isExtensible} returns
 * `false` (which it does on this class), so that's what's implemented.
 *
 * In addition, this class provides a static method {@link #makeProxy} for
 * convenient proxy construction.
 */
export default class BaseProxyHandler extends CommonBase {
  /**
   * Constructs and returns a proxy which wraps an instance of this class,
   * and with a frozen no-op function as the target. The instance of this class
   * is constructed with whatever arguments get passed to this method.
   *
   * @param {...*} args Construction arguments to pass to this class's
   *   constructor.
   * @returns {Proxy} Proxy instance which uses an instance of this class as its
   *   handler and which adopts a baseline identity as a function.
   */
  static makeFunctionProxy(...args) {
    // **Note:** `this` in the context of a static method is the class.
    const handler = new this(...args);

    return new Proxy(Object.freeze(() => undefined), handler);
  }

  /**
   * Constructs and returns a proxy which wraps an instance of this class,
   * and with a frozen empty object as the target. The instance of this class
   * is constructed with whatever arguments get passed to this method.
   *
   * @param {...*} args Construction arguments to pass to this class's
   *   constructor.
   * @returns {Proxy} Proxy instance which uses an instance of this class as its
   *   handler.
   */
  static makeProxy(...args) {
    // **Note:** `this` in the context of a static method is the class.
    const handler = new this(...args);

    return new Proxy(Object.freeze({}), handler);
  }

  /**
   * Constructs an instance.
   */
  constructor() {
    super();
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {object} thisArg_unused The `this` argument passed to the call.
   * @param {array} args_unused List of arguments passed to the call.
   */
  apply(target_unused, thisArg_unused, args_unused) {
    throw Errors.badUse('Unsupported proxy operation.');
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {array} args_unused List of arguments passed to the constructor.
   * @param {object} newTarget_unused The constructor that was originally
   *   called, which is to say, the proxy object.
   */
  construct(target_unused, args_unused, newTarget_unused) {
    throw Errors.badUse('Unsupported proxy operation.');
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {string} property_unused The property name.
   * @param {object} descriptor_unused The property descriptor.
   * @returns {boolean} `false`, always.
   */
  defineProperty(target_unused, property_unused, descriptor_unused) {
    return false;
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {string} property_unused The property name.
   * @returns {boolean} `false`, always.
   */
  deleteProperty(target_unused, property_unused) {
    return false;
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {string} property_unused The property name.
   * @param {object} receiver_unused The original receiver of the request.
   * @returns {undefined} `undefined`, always.
   */
  get(target_unused, property_unused, receiver_unused) {
    return undefined;
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {string} property_unused The property name.
   */
  getOwnPropertyDescriptor(target_unused, property_unused) {
    throw Errors.badUse('Unsupported proxy operation.');
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target The proxy target.
   * @returns {*} `target`'s prototype.
   */
  getPrototypeOf(target) {
    // **Note:** In the original version of this class, this method was
    // implemented as simply `return null`. However, the Babel polyfill code for
    // `Proxy` complained thusly:
    //
    //   Proxy's 'getPrototypeOf' trap for a non-extensible target should return
    //   the same value as the target's prototype
    //
    // The Mozilla docs for `Proxy` agree with this assessment, stating:
    //
    //   If `target` is not extensible, `Object.getPrototypeOf(proxy)` method
    //   must return the same value as `Object.getPrototypeOf(target).`
    //
    // Hence this revised version.

    return Object.getPrototypeOf(target);
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {string} property_unused The property name.
   * @returns {boolean} `false`, always.
   */
  has(target_unused, property_unused) {
    return false;
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @returns {boolean} `false`, always.
   */
  isExtensible(target_unused) {
    return false;
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @returns {array} `[]`, always.
   */
  ownKeys(target_unused) {
    return [];
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @returns {boolean} `true`, always.
   */
  preventExtensions(target_unused) {
    return true;
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {string} property_unused The property name.
   * @param {*} value_unused The new property value.
   * @param {object} receiver_unused The original receiver of the request.
   * @returns {boolean} `false`, always.
   */
  set(target_unused, property_unused, value_unused, receiver_unused) {
    return false;
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {object|null} prototype_unused The new prototype.
   * @returns {boolean} `false`, always.
   */
  setPrototypeOf(target_unused, prototype_unused) {
    return false;
  }
}
