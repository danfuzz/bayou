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
    const meta = api.meta;

    return meta.makeChallenge(id).then((challenge) => {
      api.log.info(`Got challenge: ${id} ${challenge}`);
      const response = key.challengeResponseFor(challenge);
      return meta.authWithChallengeResponse(challenge, response);
    }).then(() => {
      // Successful auth.
      api.log.info(`Authed: ${id}`);
      return this.getOrCreate(id);
    });
  }

  /**
   * Gets the proxy for the target with the given ID.
   *
   * @param {string} id The target ID.
   * @returns {Proxy} The corresponding proxy.
   */
  get(id) {
    const result = this._targets.get(id);

    if (!result) {
      throw new Error(`No such target: ${id}`);
    }

    return result;
  }

  /**
   * Gets the proxy for the target with the given ID. If this ID isn't actually
   * known to this instance, it creates it first, adding it to the map.
   *
   * @param {string} id The target ID.
   * @returns {Proxy} The corresponding proxy.
   */
  getOrCreate(id) {
    TString.check(id);

    const already = this._targets.get(id);

    if (already) {
      return already;
    }

    const result = TargetHandler.makeProxy(this._apiClient, id);
    this._targets.set(id, result);
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
    return this._targets.get(id) || null;
  }

  /**
   * Resets the targets of this instance. This is used during instance init
   * as well as when a connection gets reset.
   */
  reset() {
    this._targets = new Map();

    // Set up the standard initial map contents.
    this.getOrCreate('main');
    this.getOrCreate('meta');
  }
}
