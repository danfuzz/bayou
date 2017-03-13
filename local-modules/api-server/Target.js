// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseKey } from 'api-common';
import { TArray, TObject, TString } from 'typecheck';

import Schema from './Schema';

/**
 * Wrapper for an object which is callable through the API. A target can be
 * either "controlled" by a key (that is, have access restricted by a key) or be
 * "uncontrolled" (that is, be generally available without additional permission
 * checks).
 */
export default class Target {
  /**
   * Constructs an instance which wraps the given object.
   *
   * @param {string|BaseKey} nameOrKey Either the name of the target (if
   *   uncontrolled) _or_ the key which controls access to the target. In the
   *   former case, the target's `id` is taken to be the given name. In the
   *   latter case, the target's `id` is considered to be the same as the key's
   *   `id`.
   * @param {object} target Object to provide access to.
   * @param {Schema|null} schema `target`'s schema, if already known.
   */
  constructor(nameOrKey, target, schema = null) {
    /**
     * {BaseKey|null} The access key, or `null` if this is an uncontrolled
     * target.
     */
    this._key = (nameOrKey instanceof BaseKey) ? nameOrKey : null;

    /** {string} The target ID. */
    this._id = (this._key === null)
      ? TString.check(nameOrKey)
      : this._key.id;

    /** {object} The target object. */
    this._target = TObject.check(target);

    /** {Schema} Schema for the target. */
    this._schema = schema || new Schema(target);

    Object.freeze(this);
  }

  /**
   * {BaseKey|null} The access control key or `null` if this is an
   * uncontrolled target.
   */
  get key() {
    return this._key;
  }

  /** {string} The target ID. */
  get id() {
    return this._id;
  }

  /** {object} The underlying target object. */
  get target() {
    return this._target;
  }

  /** {Schema} The target's schema. */
  get schema() {
    return this._schema;
  }

  /**
   * Returns an instance just like this one, except without the `key`. This
   * method is used during resource authorization.
   *
   * @returns {Target} An "uncontrolled" version of this instance.
   */
  withoutKey() {
    return new Target(this._id, this._target, this._schema);
  }

  /**
   * Synchronously performs a method call on the target object, returning the
   * result or (directly) throwing an error.
   *
   * @param {string} name The method name.
   * @param {Array} args Arguments to the method.
   * @returns {Promise} A promise for the result.
   */
  call(name, args) {
    TString.nonempty(name);
    TArray.check(args);

    const schema = this._schema;

    if (schema.getDescriptor(name) !== 'method') {
      // Not in the schema, or not a method.
      throw new Error(`No such method: \`${this._name}.${name}\``);
    }

    // Listed in the schema as a method. So it exists, is public, is in
    // fact bound to a function, etc.

    const target = this._target;
    const impl = target[name];
    return impl.apply(target, args);
  }
}
