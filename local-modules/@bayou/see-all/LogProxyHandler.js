// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { TFunction } from '@bayou/typecheck';
import { MethodCacheProxyHandler } from '@bayou/util-common';

/**
 * Proxy handler which provides the illusion of an object with infinitely many
 * properties, each of which is a method that can be used to emit a
 * structured-event log with the same name as the property.
 *
 * For example, `proxy.blort(1, 2, 3)` will cause a `blort` event to
 * be logged with arguments `[1, 2, 3]`.
 */
export default class LogProxyHandler extends MethodCacheProxyHandler {
  /**
   * Constructs an instance.
   *
   * @param {function} logFunction Function to call through to to perform
   *   logging. It must take a string name as the first argument and arbitrary
   *   additional arguments.
   */
  constructor(logFunction) {
    super();

    /** {function} Function to call through to to perform logging. */
    this._logFunction = TFunction.checkCallable(logFunction);

    Object.freeze(this);
  }

  /**
   * Makes a method handler for the given method name.
   *
   * @param {string|Symbol} name The method name.
   * @returns {function} An appropriately-constructed handler.
   */
  _impl_methodFor(name) {
    if (name === inspect.custom) {
      // Very special case: We're being asked for the method for the standard
      // "custom inspector" function. Return a straightforward implementation.
      // This makes it possible to call `util.inspect` on a proxy made from an
      // instance of this class and get a reasonably useful result (instead of
      // calling through to the `_logFunction` and logging something
      // inscrutable), which is a case that _has_ arisen in practice (while
      // debugging).
      return () => '[object LogProxy]';
    } else if (typeof name === 'symbol') {
      // Make a valid label out of the symbol's name.
      const rawName = name.toString().replace(/^Symbol\(|\)$/g, '');
      name = `symbol-${rawName}`;
    }

    return (...args) => {
      this._logFunction(name, ...args);
    };
  }
}
