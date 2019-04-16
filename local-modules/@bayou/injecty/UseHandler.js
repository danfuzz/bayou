// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseProxyHandler } from '@bayou/util-common';

import ConfigMap from './ConfigMap';

/**
 * Proxy handler which underlies {@link use}.
 */
export default class UseHandler extends BaseProxyHandler {
  /**
   * Constructs an instance.
   *
   * @param {ConfigMap} map Map to store injected configurations into.
   */
  constructor(map) {
    super();

    /** {ConfigMap} Map to retrieve injected configurations from. */
    this._map = ConfigMap.check(map);

    Object.freeze(this);
  }

  /**
   * Standard `Proxy` handler method. This uses {@link #_map} as the source of
   * property bindings. It is an error &mdash; the method will throw &mdash;
   * if an attempt is made to get a property name that was never stored to.
   *
   * @param {object} target_unused The proxy target.
   * @param {string|Symbol} property The property name.
   * @param {object} receiver_unused The original receiver of the request.
   * @returns {*} The property, or `undefined` if there is no such property
   *   defined.
   */
  get(target_unused, property, receiver_unused) {
    return this._map.get(property);
  }
}
