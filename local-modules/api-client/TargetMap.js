// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';

import TargetHandler from './TargetHandler';

/**
 * Map of the various targets being provided by a connection. Items present in
 * this map are assumed to be _uncontrolled_ targets, that is, without an
 * auth requirements (or, to the extent that auth requirements were ever
 * present, that they have already been fulfilled).
 */
export default class TargetMap {
  /**
   * Constructs an instance.
   *
   * @param {ApiClient} apiClient The client to forward calls to.
   */
  constructor(apiClient) {
    /** {ApiClient} The client to forward calls to. */
    this._apiClient = apiClient;

    /**
     * {Map<string, TargetHandler>} The targets being provided, as a map from ID
     * to proxy. Initialized in `reset()`.
     */
    this._targets = null;

    /**
     * {Map<string, Promise<Proxy>>} Map from target IDs to promises of their
     * proxy, for each ID currently in the middle of being authorized. Used to
     * avoid re-issuing authorization requests.
     */
    this._pendingAuths = new Map();

    this.reset();
  }

  /**
   * Performs a challenge-response authorization for a given key. When the
   * returned promise resolves successfully, that means that the corresponding
   * target (that is, the target with id `key.id`) can be accessed without
   * further authorization and is in fact mapped by this instance.
   *
   * If `key.id` is already mapped by this instance, the corresponding target
   * is returned directly without further authorization. (That is, this method
   * is idempotent.)
   *
   * @param {BaseKey} key Key to authorize with.
   * @returns {Promise<Proxy>} Promise which resolves to the proxy that
   *   represents the foreign target which is controlled by `key`, once
   *   authorization is complete.
   */
  authorizeTarget(key) {
    const id = key.id;
    const api = this._apiClient;
    const log = api.log;
    const meta = api.meta;
    let result;

    result = this._targets.get(id);
    if (result) {
      // The target is already authorized. Return an immediately-resolved
      // promise for it. (We don't just return it directly, as that would
      // violate the method contract. And the method contract is written as such
      // because it's generally considered a Zalgo-summoning type situation if
      // you sometimes return promises and sometimes don't.)
      return Promise.resolve(result);
    }

    result = this._pendingAuths.get(id);
    if (result) {
      // We have already initiated authorization on this target. Return the
      // promise from the original initiation.
      log.info(`Already authing: ${id}`);
      return result;
    }

    // It's not already authorized (or uncontrolled), and authorization isn't
    // yet in progress.

    result = meta.makeChallenge(id).then((challenge) => {
      log.info(`Got challenge: ${id} ${challenge}`);
      const response = key.challengeResponseFor(challenge);
      return meta.authWithChallengeResponse(challenge, response);
    }).then(() => {
      // Successful auth.
      log.info(`Authed: ${id}`);
      this._pendingAuths.delete(id); // It's no longer pending.
      return this._addTarget(id);
    }).catch((error) => {
      // Trouble along the way. Clean out the pending auth, and propagate the
      // error.
      log.error(`Auth failed: ${id}`);
      this._pendingAuths.delete(id);
      throw error;
    });

    this._pendingAuths.set(id, result); // It's now pending.
    return result;
  }

  /**
   * Gets the proxy for the target with the given ID.
   *
   * @param {string} id The target ID.
   * @returns {Proxy} The corresponding proxy.
   */
  get(id) {
    const result = this.getOrNull(id);

    if (!result) {
      throw new Error(`No such target: ${id}`);
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
    TString.check(id);
    return this._targets.get(id) || null;
  }

  /**
   * Resets the targets of this instance. This is used during instance init
   * as well as when a connection gets reset.
   */
  reset() {
    this._targets = new Map();
    this._pendingAuths = new Map();

    // Set up the standard initial map contents.
    this._addTarget('meta');
  }

  /**
   * Creates and binds a proxy for the target with the given ID. Returns the
   * so-created proxy.
   *
   * @param {string} id Target ID.
   * @returns {Proxy} The newly-bound proxy.
   */
  _addTarget(id) {
    if (this.getOrNull(id) !== null) {
      throw new Error(`Already bound: ${id}`);
    }

    const result = TargetHandler.makeProxy(this._apiClient, id);
    this._targets.set(id, result);
    return result;
  }
}
