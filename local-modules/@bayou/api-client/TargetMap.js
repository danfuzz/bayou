// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TargetId } from '@bayou/api-common';
import { TFunction } from '@bayou/typecheck';
import { CommonBase, Errors } from '@bayou/util-common';

import TargetHandler from './TargetHandler';

/**
 * Map of the various targets being provided by a connection. Items present in
 * this map are assumed to be _uncontrolled_ targets, that is, without an
 * auth requirements (or, to the extent that auth requirements were ever
 * present, that they have already been fulfilled).
 */
export default class TargetMap extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {function} sendMessage Function to call to send a message. This is
   *   bound to the private `_send()` method on an instance of
   *   {@link ApiClient}. (This arrangement is done, instead of making a public
   *   `send()` method on {@link ApiClient}, so as to make it clear that the
   *   right way to send messages is via the exposed proxies.)
   */
  constructor(sendMessage) {
    super();

    /** {function} Function to call to send a message. */
    this._sendMessage = TFunction.checkCallable(sendMessage);

    /**
     * {Map<string, TargetHandler>} The targets being provided, as a map from ID
     * to proxy.
     */
    this._targets = new Map();

    Object.freeze(this);
  }

  /**
   * Creates and binds a proxy for the target with the given ID. Returns the
   * so-created proxy. It is an error to try to add the same `id` more than
   * once (except if {@link #clear} is called in the mean time).
   *
   * @param {string} id Target ID.
   * @returns {Proxy} The newly-bound proxy.
   */
  add(id) {
    if (this.getOrNull(id) !== null) {
      throw Errors.badUse(`Already bound: ${id}`);
    }

    const result = TargetHandler.makeProxy(this._sendMessage, id);
    this._targets.set(id, result);
    return result;
  }

  /**
   * Adds the target as if by {@link #add} if not already bound, or returns the
   * pre-existing binding as if by {@link #get}.
   *
   * @param {string} id Target ID.
   * @returns {Proxy} The corresponding proxy.
   */
  addOrGet(id) {
    const already = this.getOrNull(id);

    return (already === null) ? this.add(id) : already;
  }

  /**
   * Clears out the targets of this instance.
   */
  clear() {
    this._targets.clear();
  }

  /**
   * Gets the proxy for the target with the given ID. It is an error to pass an
   * `id` that is not bound.
   *
   * @param {string} id The target ID.
   * @returns {Proxy} The corresponding proxy.
   */
  get(id) {
    const result = this.getOrNull(id);

    if (result === null) {
      throw Errors.badUse(`No such target: ${id}`);
    }

    return result;
  }

  /**
   * Gets the proxy for the target with the given ID, or `null` if there is no
   * such target.
   *
   * @param {string} id The target ID.
   * @returns {Proxy|null} The corresponding proxy, or `null` if `id` isn't
   *   bound to a target.
   */
  getOrNull(id) {
    TargetId.check(id);
    return this._targets.get(id) || null;
  }
}
