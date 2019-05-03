// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TFunction } from '@bayou/typecheck';
import { Functor, MethodCacheProxyHandler } from '@bayou/util-common';

/**
 * Proxy handler which gets bound as {@link EventSource#emit}. It allows itself
 * to be called as a function which takes a {@link Functor} payload, and &mdash;
 * more interestingly &mdash; offers any property as a function which emits an
 * event with that property's name.
 */
export class EmitHandler extends MethodCacheProxyHandler {
  /**
   * Constructs an instance.
   *
   * @param {function} emit Function to call to actually emit an event. Called
   *   with a single {@link Functor} argument and is expected to return a
   *   {@link ChainedEvent} instance.
   */
  constructor(emit) {
    super();

    /** {function} Function to call to actually emit an event. */
    this._emit = TFunction.checkCallable(emit);

    Object.freeze(this);
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {object} thisArg_unused The `this` argument passed to the call.
   * @param {array} args List of arguments passed to the call.
   * @returns {*} Result from underlying `emit()` call.
   */
  apply(target_unused, thisArg_unused, args) {
    return this._emit(...args);
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {string|Symbol} name The method name.
   * @returns {function} An appropriately-constructed handler.
   */
  _impl_methodFor(name) {
    return (...args) => {
      return this._emit(new Functor(name, ...args));
    };
  }
}
