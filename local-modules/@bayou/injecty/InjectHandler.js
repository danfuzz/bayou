// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseProxyHandler } from '@bayou/util-common';

import ConfigMap from './ConfigMap';

/**
 * Proxy handler which underlies {@link inject}.
 */
export default class InjectHandler extends BaseProxyHandler {
  /**
   * Constructs an instance.
   *
   * @param {ConfigMap} map Map to store injected configurations into.
   */
  constructor(map) {
    super();

    /** {ConfigMap} Map to store injected configurations into. */
    this._map = ConfigMap.check(map);

    Object.freeze(this);
  }

  /**
   * Standard `Proxy` handler method. This uses {@link #_map} to store whatever
   * this method is given. It is an error &mdash; the method will throw &mdash;
   * if an attempt is made to store to a given name more than once.
   *
   * @param {object} target_unused The proxy target.
   * @param {string|Symbol} property The property name.
   * @param {*} value The new property value.
   * @param {object} receiver_unused The original receiver of the request.
   * @returns {boolean} `true`, always.
   */
  set(target_unused, property, value, receiver_unused) {
    this._map.add(property, value);
    return true;
  }
}
