// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TFunction } from '@bayou/typecheck';
import { CommonBase, Errors } from '@bayou/util-core';

/** {Set<string>} Set of methods which never get proxied. */
const VERBOTEN_METHODS = new Set([
  // Standard constructor method name.
  'constructor',

  // Promise interface. If proxied, this confuses the promise system, as it
  // just looks for these methods to figure out if it's working with a
  // "promise."
  'then',
  'catch'
]);

/**
 * Base class for a proxy handler for the common pattern of keeping a cache of
 * computed methods, along with a subclass hole to be filled in for how to
 * compute those methods in the first place.
 *
 * As a special case, this class refuses to proxy properties named
 * `constructor`, `then`, or `catch`. The former if proxied can confuse the
 * system into thinking what's being proxied is a class. The latter two can
 * confuse the system into thinking that what's being proxied is a promise.
 * (Duck typing FTL!) Though in the larger sense it is okay to proxy these
 * things, the usual case &mdash; and the one supported by this class &mdash; is
 * that what's proxied is just a plain-old-instance filled with normal methods.
 *
 * Use this class by making a subclass, filling in the `_impl`, and constructing
 * a `Proxy` with an instance of it as the handler. The "target" of the proxy is
 * ignored and can just be an empty object.
 */
export default class MethodCacheProxyHandler extends CommonBase {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    /**
     * {Map<string, function>} Cached method call handlers, as a map from name
     * to handler.
     */
    this._methods = new Map();
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
   * Standard `Proxy` handler method. This defers to {@link #_impl_methodFor}
   * to generate method handlers that aren't yet cached.
   *
   * @param {object} target_unused The proxy target.
   * @param {string} property The property name.
   * @param {object} receiver_unused The original receiver of the request.
   * @returns {*} The property, or `undefined` if there is no such property
   *   defined.
   */
  get(target_unused, property, receiver_unused) {
    const method = this._methods.get(property);

    if (method) {
      return method;
    } else if (VERBOTEN_METHODS.has(property)) {
      // This property is on the blacklist of ones to never proxy.
      return undefined;
    } else {
      // The property is allowed to be proxied. Set up and cache a handler for
      // it.
      const result = TFunction.checkCallable(this._impl_methodFor(property));
      this._methods.set(property, result);
      return result;
    }
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

  /**
   * Makes a method handler for the given method name. The handler will
   * ultimately get called by client code as a method on a proxy instance.
   *
   * @abstract
   * @param {string} name The method name.
   * @returns {function} An appropriately-constructed handler.
   */
  _impl_methodFor(name) {
    return this._mustOverride(name);
  }
}
