// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { PropertyDelta, PropertyOp } from 'doc-common';
import { Delay } from 'promise-util';
import { TString } from 'typecheck';
import { CommonBase } from 'util-common';

import DocSession from './DocSession';

/**
 * Accessor for document properties.
 *
 * **TODO:** This implementation is very inefficient, in that it never caches
 * anything locally and it doesn't batch updates to send to the server. This
 * should be fixed!
 */
export default class PropertyClient extends CommonBase {
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
     * {Proxy|null} Proxy for the server-side session object. Becomes non-`null`
     * when the promise for same resolves, as arranged for in this constructor,
     * below.
     */
    this._sessionProxy = null;

    // Arrange for `_sessionProxy` to get set.
    (async () => {
      this._sessionProxy = await docSession.getSessionProxy();
      this._log.detail('Property client got session proxy.');
    })();
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
    const delta = new PropertyDelta([PropertyOp.op_deleteProperty(name)]);

    const proxy    = await this._proxyWhenReady();
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

    const proxy    = await this._proxyWhenReady();
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

    const proxy    = await this._proxyWhenReady();
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
    const delta = new PropertyDelta([PropertyOp.op_setProperty(name, value)]);

    const proxy    = await this._proxyWhenReady();
    const snapshot = await proxy.property_getSnapshot();

    await proxy.property_update(snapshot.revNum, delta);
  }

  /**
   * Waits for the session proxy to be ready, and returns it once it is.
   *
   * @returns {Proxy} The session proxy.
   */
  async _proxyWhenReady() {
    // **TODO:** This should be driven by a `Condition` instead of polling.
    for (;;) {
      if (this._sessionProxy !== null) {
        break;
      }

      this._log.info('Waiting for session proxy...');
      await Delay.resolve(1000);
    }

    return this._sessionProxy;
  }
}
