// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TObject } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

/**
 * Wrapper for an object which is to be proxied over an API connection.
 * Instances of this class can be returned by methods of other proxied objects
 * to indicate that those return values should be proxied rather than returned
 * as encoded values. When a {@link BaseConnection} encounters one of these as a
 * return value, it automatically registers its {@link #target} as a target in
 * the connection's associated context if not already present. If the target
 * _is_ already present, then the pre-existing target is used. In either case,
 * the response message sent to the client indicates that the result is a
 * proxied object and not a regular encoded value.
 */
export class ProxiedObject extends CommonBase {
  /**
   * Constructs an instance which wraps the given object.
   *
   * @param {object} target Object to provide access to.
   */
  constructor(target) {
    super();

    /** {object} The target object. */
    this._target = TObject.check(target);

    Object.freeze(this);
  }

  /** {object} The underlying target object. */
  get target() {
    return this._target;
  }

  /**
   * Gets reconstruction arguments for this instance. Instances of this class
   * aren't typically registered as encodable on an API connection. However,
   * {@link CommonBase} uses this method when available when supplying output
   * for `inspect()`, which is why this is implemented here.
   *
   * @returns {array<*>} Reconstruction arguments.
   */
  deconstruct() {
    return [this._target];
  }
}
