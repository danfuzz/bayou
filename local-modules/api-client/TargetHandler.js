// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * `Proxy` handler which redirects method calls to an indicated client.
 */
export default class TargetHandler {
  /**
   * Makes a proxy that is handled by an instance of this class.
   *
   * @param {ApiClient} apiClient The client to forward calls to.
   * @returns {Proxy} An appropriately-constructed proxy object.
   */
  static makeProxy(apiClient) {
    return new Proxy(Object.freeze({}), new TargetHandler(apiClient));
  }

  /**
   * Constructs an instance. It only becomes usable after a call to `open()`
   * has completed (asynchronously).
   *
   * @param {ApiClient} apiClient The client to forward calls to.
   */
  constructor(apiClient) {
    /** The client to forward calls to. */
    this._apiClient = apiClient;

    /**
     * Cached method call handlers, for both regular and meta-methods. This
     * gets initialized to just `schema` and `connectionId` (as meta-methods),
     * and then gets fully populated once the server hands us a schema.
     */
    this._methods = {
      'connectionId': this._makeMethodHandler('meta', 'connectionId'),
      'schema':       this._makeMethodHandler('meta', 'schema')
    };

    /** State of readiness, one of `not`, `readying`, or `ready`. */
    this._readyState = 'not';
  }

  /**
   * Makes a method handler for the given action and name.
   *
   * @param {string} action The action.
   * @param {string} name The method name.
   * @returns {function} An appropriately-constructed handler.
   */
  _makeMethodHandler(action, name) {
    const apiClient = this._apiClient; // Avoid re-(re-)lookup on every call.
    return (...args) => {
      return apiClient._send(action, name, args);
    };
  }

  /**
   * Sets up the method handler table. This gets called as a byproduct of the
   * first method lookup.
   */
  _becomeReady() {
    if (this._readyState !== 'not') {
      return;
    }

    this._readyState = 'readying';

    this._apiClient.target.schema().then((schema) => {
      const methods = this._methods;

      for (const name in schema.meta) {
        if (!methods[name]) {
          methods[name] = this._makeMethodHandler('meta', name);
        }
      }

      for (const name in schema.methods) {
        if (!methods[name]) {
          methods[name] = this._makeMethodHandler('call', name);
        }
      }

      this._readyState = 'ready';
    });
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
    const method = this._methods[property];

    if (this._readyState === 'not') {
      // We're getting accessed but aren't yet fully set up (and aren't already
      // in the middle of doing so).
      this._becomeReady();
    }

    if (method || this._ready) {
      return method;
    } else {
      // We're still starting up. Assume that this is a non-meta method, but
      // _don't_ cache it, in case we're wrong.
      return this._makeMethodHandler('call', property);
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
   * @param {object} target_unused The proxy target.
   * @returns {void} `null`, always.
   */
  getPrototypeOf(target_unused) {
    return null;
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
}
