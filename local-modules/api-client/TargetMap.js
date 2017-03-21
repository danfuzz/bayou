// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';

import TargetHandler from './TargetHandler';

/**
 * Map of the various targets being provided by a connection.
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
     * to proxy.
     */
    this._targets = new Map();

    // Set up the standard initial map contents.
    this.createOrGet('main');
    this.createOrGet('meta');
  }

  /**
   * Gets the proxy for the target with the given ID. If this ID isn't actually
   * known to this instance, it creates it first, adding it to the map.
   *
   * @param {string} id The target ID.
   * @returns {Proxy} The corresponding proxy.
   */
  createOrGet(id) {
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
}
