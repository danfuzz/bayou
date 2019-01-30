// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BearerToken, TargetId } from '@bayou/api-common';
import { TObject } from '@bayou/typecheck';
import { CommonBase, Errors, Functor } from '@bayou/util-common';

import Schema from './Schema';

/**
 * Wrapper for an object which is callable through the API. A target can be
 * either "controlled" by a key (that is, have access restricted by a key) or be
 * "uncontrolled" (that is, be generally available without additional permission
 * checks).
 */
export default class Target extends CommonBase {
  /**
   * Constructs an instance which wraps the given object.
   *
   * @param {string|BearerToken} idOrToken Either the ID of the target (if
   *   uncontrolled) _or_ the token which authorizes access to the target. In
   *   the latter case, the target's `id` is considered to be the same as the
   *   token's `id`.
   * @param {object} directObject Object to be represented by this instance.
   * @param {Schema|null} schema `directObject`'s schema, if already known.
   */
  constructor(idOrToken, directObject, schema = null) {
    super();

    /**
     * {BearerToken|null} Token which authorizes access to the target, or `null`
     * if this is an uncontrolled instance.
     */
    this._token = (idOrToken instanceof BearerToken) ? idOrToken : null;

    /** {string} The target ID. */
    this._id = TargetId.check((this._token === null) ? idOrToken : this._token.id);

    /**
     * {object} The object which this instance represents, wraps, and generally
     * provides access to.
     */
    this._directObject = TObject.check(directObject);

    /** {Schema} Schema for {@link #_directObject}. */
    this._schema = schema || new Schema(directObject);

    Object.freeze(this);
  }

  /**
  * {object} The object which this instance represents, wraps, and generally
  * provides access to. Accessing this property indicates that this instance is
  * _not_ currently idle.
  */
  get directObject() {
    return this._directObject;
  }

  /** {string} The target ID. */
  get id() {
    return this._id;
  }

  /** {Schema} The schema of {@link #directObject}. */
  get schema() {
    return this._schema;
  }

  /**
   * {BearerToken|null} Token which authorizes access to the target, or `null`
   * if this is an uncontrolled instance.
   */
  get token() {
    return this._token;
  }

  /**
   * Synchronously performs a method call on the {@link #directObject},
   * returning the result or (directly) throwing an error.
   *
   * @param {Functor} payload The name of the method to call and the arguments
   *   to call it with.
   * @returns {*} The result of performing the call.
   */
  call(payload) {
    Functor.check(payload);

    const name   = payload.name;
    const schema = this._schema;

    if (schema.getDescriptor(name) !== 'method') {
      // Not in the schema, or not a method.
      throw Errors.badUse(`No such method: \`${name}\``);
    }

    // Listed in the schema as a method. So it exists, is public, is in
    // fact bound to a function, etc.

    const obj  = this._directObject;
    const impl = obj[name];

    return impl.apply(obj, payload.args);
  }
}
