// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { PropertyDelta, PropertyOp, Timeouts } from '@bayou/doc-common';
import { TString } from '@bayou/typecheck';
import { CommonBase, DataUtil, Errors } from '@bayou/util-common';

import { DocSession } from './DocSession';

/**
 * Accessor for document properties.
 *
 * **TODO:** This implementation is very inefficient, in that it never caches
 * anything locally and it doesn't batch updates to send to the server. This
 * should be fixed!
 */
export class PropertyClient extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {DocSession} docSession Session that this instance is tied to.
   */
  constructor(docSession) {
    super();

    /** {DocSession} Session that this instance is tied to. */
    this._docSession = DocSession.check(docSession);

    /** {Logger} Logger specific to the session. */
    this._log = docSession.log;

    /**
     * {Promise<Proxy>} Promise for the proxy to the server-side session object.
     * Typically becomes resolved very soon after a server connection is
     * initiated.
     */
    this._sessionProxyPromise = docSession.getSessionProxy();
  }

  /**
   * Deletes the value for a particular property. If `name` isn't bound, then
   * this simply does nothing. (It's not an error, so as to be tolerant of
   * simultaneous deletion by multiple clients.)
   *
   * @param {string} name Property name. Must be a valid "identifier" string.
   */
  async delete(name) {
    // The op constructor type checks its arguments.
    const delta = new PropertyDelta([PropertyOp.op_delete(name)]);

    const proxy    = await this._sessionProxyPromise;
    const snapshot = await proxy.property_getSnapshot();

    await proxy.property_update(snapshot.revNum, delta);
  }

  /**
   * Gets the value for a particular property. It is an error to request a
   * `name` which is not actually bound to a property.
   *
   * @param {string} name Property name. Must be a valid "identifier" string.
   * @returns {*} The value bound to the indicated `name`.
   */
  async get(name) {
    TString.identifier(name);

    const proxy    = await this._sessionProxyPromise;
    const snapshot = await proxy.property_getSnapshot();

    return snapshot.get(name).value;
  }

  /**
   * Gets an indication of whether or not the indicated property is bound to a
   * value.
   *
   * @param {string} name Property name. Must be a valid "identifier" string.
   * @returns {boolean} `true` if the document has a binding for the indicated
   *   property, or `false` if not.
   */
  async has(name) {
    TString.identifier(name);

    const proxy    = await this._sessionProxyPromise;
    const snapshot = await proxy.property_getSnapshot();

    return snapshot.has(name);
  }

  /**
   * Sets the value for a particular property.
   *
   * @param {string} name Name of the property being set. Must be an
   *   "identifier" string.
   * @param {*} value Value of the property. Must be a pure data value.
   */
  async set(name, value) {
    // The op constructor type checks its arguments.
    const delta = new PropertyDelta([PropertyOp.op_set(name, value)]);

    const proxy    = await this._sessionProxyPromise;
    const snapshot = await proxy.property_getSnapshot();

    await proxy.property_update(snapshot.revNum, delta);
  }

  /**
   * Returns the new value for a given property, once it is bound to a different
   * value from the one given. If the property loses its value (that is, the
   * property is deleted), that will _not_ cause this method to return.
   *
   * **Note:** Due to the asynchronous nature of the system, the property's
   * value could possibly have changed _again_ by the time the caller receives
   * its result.
   *
   * @param {string} name Name of the property to monitor. Must be an
   *   "identifier" string.
   * @param {*} value Value of the property. Must be a pure data value.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call. If specified, this value will be silently clamped to a
   *   system-defined range. If `null`, defaults to the maximum allowed.
   * @returns {*} New value of the property, soon after it gets changed.
   * @throws {Error} A `timedOut` error if the property doesn't change within
   *   a reasonable period of time.
   */
  async getUpdate(name, value, timeoutMsec = null) {
    // Use the op constructor just for its type checking.
    PropertyOp.op_set(name, value);

    timeoutMsec = Timeouts.clamp(timeoutMsec);

    const timeoutTime = Date.now() + timeoutMsec;
    const proxy       = await this._sessionProxyPromise;

    for (;;) {
      const snapshot = await proxy.property_getSnapshot();
      const gotProp  = snapshot.getOrNull(name);

      if (gotProp !== null) {
        const gotValue = gotProp.value;
        if (!DataUtil.equalData(value, gotValue)) {
          return gotValue;
        }
      }

      const now = Date.now();
      if (now >= timeoutTime) {
        throw Errors.timedOut(timeoutMsec);
      }

      await proxy.property_getChangeAfter(snapshot.revNum, timeoutTime - now);
    }
  }
}
