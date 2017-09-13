// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase, Functor } from 'util-common';

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
 * `Proxy` handler which redirects method calls to an indicated client.
 */
export default class TargetHandler extends CommonBase {
  /**
   * Makes a proxy that is handled by an instance of this class.
   *
   * @param {ApiClient} apiClient The client to forward calls to.
   * @param {string} targetId The ID of the target to call on.
   * @returns {Proxy} An appropriately-constructed proxy object.
   */
  static makeProxy(apiClient, targetId) {
    return new Proxy(Object.freeze({}), new TargetHandler(apiClient, targetId));
  }

  /**
   * Constructs an instance.
   *
   * @param {ApiClient} apiClient The client to forward calls to.
   * @param {string} targetId The ID of the target to call on.
   */
  constructor(apiClient, targetId) {
    super();

    /** The client to forward calls to. */
    this._apiClient = apiClient;

    /** {string} The ID of the target. */
    this._targetId = targetId;

    /**
     * {Map<string, function>} Cached method call handlers, as a map from name
     * to handler.
     */
    this._methods = new Map();

    /** State of readiness, one of `not`, `readying`, or `ready`. */
    this._readyState = 'not';

    Object.seal(this);
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {object} thisArg_unused The `this` argument passed to the call.
   * @param {array} args_unused List of arguments passed to the call.
   */
  apply(target_unused, thisArg_unused, args_unused) {
    throw new Error('unsupported');
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {array} args_unused List of arguments passed to the constructor.
   * @param {object} newTarget_unused The constructor that was originally
   *   called.
   */
  construct(target_unused, args_unused, newTarget_unused) {
    throw new Error('unsupported');
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {string} property_unused The property name.
   * @param {object} descriptor_unused The property descriptor.
   */
  defineProperty(target_unused, property_unused, descriptor_unused) {
    throw new Error('unsupported');
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {string} property_unused The property name.
   */
  deleteProperty(target_unused, property_unused) {
    throw new Error('unsupported');
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {string} property The property name.
   * @param {object} receiver_unused The original receiver of the request.
   * @returns {*} The property, or `undefined` if there is no such property
   *   defined.
   */
  get(target_unused, property, receiver_unused) {
    const method = this._methods.get(property);

    if (this._readyState === 'not') {
      // We're getting accessed but aren't yet fully set up (and aren't already
      // in the middle of doing so).
      this._becomeReady();
    }

    if (method || this._ready) {
      return method;
    } else {
      // We're still starting up. As long as it's not explicitly verboten,
      // assume that this is a valid method, but _don't_ cache it, in case we're
      // wrong.
      return VERBOTEN_METHODS.has(property)
        ? undefined
        : this._makeMethodHandler(property);
    }
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {string} property_unused The property name.
   */
  getOwnPropertyDescriptor(target_unused, property_unused) {
    throw new Error('unsupported');
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target The proxy target.
   * @returns {void} `null`, always.
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
   */
  set(target_unused, property_unused, value_unused, receiver_unused) {
    throw new Error('unsupported');
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {object|null} prototype_unused The new prototype.
   */
  setPrototypeOf(target_unused, prototype_unused) {
    throw new Error('unsupported');
  }

  /**
   * Sets up the method handler table. This gets called as a byproduct of the
   * first property lookup.
   */
  async _becomeReady() {
    if (this._readyState !== 'not') {
      return;
    }

    this._readyState = 'readying';

    const schema = await this._apiClient.meta.schemaFor(this._targetId);
    const methods = this._methods;

    for (const name in schema[this._targetId]) {
      if (!VERBOTEN_METHODS.has(name)) {
        methods.set(name, this._makeMethodHandler(name));
      }
    }

    this._readyState = 'ready';
  }

  /**
   * Makes a method handler for the given method name.
   *
   * @param {string} name The method name.
   * @returns {function} An appropriately-constructed handler.
   */
  _makeMethodHandler(name) {
    const apiClient = this._apiClient;  // Avoid re-(re-)lookup on every call.
    const targetId  = this._targetId;   // Likewise.

    return (...args) => {
      return apiClient._send(targetId, new Functor(name, ...args));
    };
  }
}
