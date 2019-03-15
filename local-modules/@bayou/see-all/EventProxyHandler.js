// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { MethodCacheProxyHandler } from '@bayou/util-common';

import BaseLogger from './BaseLogger';

/**
 * Proxy handler which provides the illusion of an object with infinitely many
 * properties, each of which is a method that can be used to emit a
 * structured-event log with the same name as the property.
 *
 * For example, `proxy.blort(1, 2, 3)` will cause a `blort` event to
 * be logged with arguments `[1, 2, 3]`.
 */
export default class EventProxyHandler extends MethodCacheProxyHandler {
  /**
   * Constructs an instance.
   *
   * @param {BaseLogger} log Logger to call through to.
   */
  constructor(log) {
    super();

    /** {BaseLogger} Logger to call through to. */
    this._log = BaseLogger.check(log);

    Object.freeze(this);
  }

  /**
   * Makes a method handler for the given method name.
   *
   * @param {string} name The method name.
   * @returns {function} An appropriately-constructed handler.
   */
  _impl_methodFor(name) {
    return (...args) => {
      this._log.logEvent(name, ...args);
    };
  }
}
