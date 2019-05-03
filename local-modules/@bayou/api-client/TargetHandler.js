// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TargetId } from '@bayou/api-common';
import { TFunction } from '@bayou/typecheck';
import { Functor, MethodCacheProxyHandler } from '@bayou/util-common';

/**
 * `Proxy` handler which redirects method calls to an indicated client. It does
 * not handle any other actions aside from getting named properties (and the
 * minimal additional support for same as required by the `Proxy` contract); and
 * the properties it returns are always functions which perform calls to
 * `ApiClient._send()`.
 */
export class TargetHandler extends MethodCacheProxyHandler {
  /**
   * Constructs an instance.
   *
   * @param {function} sendMessage Function to call to send a message. See
   *   {@link TargetMap#constructor} for an explanation.
   * @param {string|BearerToken} idOrToken The ID or token for the target to
   *   call on.
   */
  constructor(sendMessage, idOrToken) {
    super();

    /** {function} Function to call to send a message. */
    this._sendMessage = TFunction.checkCallable(sendMessage);

    /** {string|BearerToken} The ID or token for the target to call on. */
    this._idOrToken = TargetId.orToken(idOrToken);

    Object.freeze(this);
  }

  /**
   * Makes a method handler for the given method name.
   *
   * @param {string|Symbol} name The method name.
   * @returns {function} An appropriately-constructed handler.
   */
  _impl_methodFor(name) {
    const sendMessage = this._sendMessage;  // Avoid re-(re-)lookup on every call.
    const idOrToken   = this._idOrToken;     // Likewise.

    return (...args) => {
      return sendMessage(idOrToken, new Functor(name, ...args));
    };
  }
}
