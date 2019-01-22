// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TargetId } from '@bayou/api-common';
import { TFunction, TObject } from '@bayou/typecheck';
import { CommonBase, Errors } from '@bayou/util-common';

import TargetHandler from './TargetHandler';

/**
 * Map of the various targets being provided over a connection. Items present in
 * this map are assumed to be _uncontrolled_ targets, that is, either (a) with
 * implied auth (e.g. a bearer token), or (b) without any auth requirements
 * (including, to the extent that auth requirements were ever present, that they
 * have already been fulfilled). This assumption only comes into play by virtue
 * of the fact that the _other_ side of the connection will balk if there turn
 * out to be auth requirements on targets that get referenced.
 */
export default class TargetMap extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {function} sendMessage Function to call to send a message. It is
   *   called with two arguments, `targetId` (a string) and `payload` (a
   *   functor). This is typically bound to the private `_send()` method on an
   *   instance of {@link ApiClient}. (This arrangement is done, instead of
   *   making a public `send()` method on {@link ApiClient}, so as to make it
   *   clear that the right way to send messages is via the exposed proxies.
   *   This arrangement also makes it possible to test this class in isolation
   *   from the higher layer.)
   */
  constructor(sendMessage) {
    super();

    /** {function} Function to call to send a message. */
    this._sendMessage = TFunction.checkCallable(sendMessage);

    /**
     * {Map<string, Proxy>} The targets being provided, as a map from ID to
     * corresponding proxy.
     */
    this._targets = new Map();

    /** {Set<Proxy>} The set of all proxies handled by this instance. */
    this._proxies = new Set();

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
    this._proxies.add(result);

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
    this._proxies.clear();
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

  /**
   * Indicates whether or not this instance is the one that handles the given
   * presumed-proxy. This returns `true` if the given `obj` is a `Proxy` that
   * was returned by a call to {@link #add} or {@link #addOrGet} on this
   * instance, _and_ it was not subsequently removed.
   *
   * @param {object} obj The presumed-proxy in question.
   * @returns {boolean} `true` if `obj` is a proxy handled by this instance, or
   *   `false` if not.
   */
  handles(obj) {
    TObject.check(obj);

    return this._proxies.has(obj);
  }
}
