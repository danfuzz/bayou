// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseKey } from 'api-common';
import { TObject, TString } from 'typecheck';
import { CommonBase, Errors, Functor } from 'util-common';

import Schema from './Schema';

/**
 * {string} Constant that indicates an "evergreen" (never idle / immortal)
 * instance.
 */
const EVERGREEN = 'evergreen';

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
   * @param {string|BaseKey} nameOrKey Either the name of the target (if
   *   uncontrolled) _or_ the key which controls access to the target. In the
   *   former case, the target's `id` is taken to be the given name. In the
   *   latter case, the target's `id` is considered to be the same as the key's
   *   `id`.
   * @param {object} target Object to provide access to.
   * @param {Schema|null} schema `target`'s schema, if already known.
   */
  constructor(nameOrKey, target, schema = null) {
    super();

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

    /**
     * {Int|'evergreen'} Timestamp (msec) when the `target` was last accessed or
     * called, or the string constant `evergreen` to indicate a target that
     * should never be considered idle. This is used to drive automated cleanup
     * of idle targets in binding contexts.
     */
    this._lastAccess = Date.now();

    Object.seal(this);
  }

  /** {string} The target ID. */
  get id() {
    return this._id;
  }

  /**
   * {BaseKey|null} The access control key or `null` if this is an
   * uncontrolled target.
   */
  get key() {
    return this._key;
  }

  /** {Schema} The target's schema. */
  get schema() {
    return this._schema;
  }

  /** {object} The underlying target object. */
  get target() {
    this.refresh();
    return this._target;
  }

  /**
   * Synchronously performs a method call on the target object, returning the
   * result or (directly) throwing an error.
   *
   * @param {Functor} payload The name of the method to call and the arguments
   *   to call it with.
   * @returns {*} The result of calling. Because `undefined` isn't used across
   *   the API, this method returns `null` if the original method returned
   *   `undefined`.
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

    this.refresh();

    const target = this._target;
    const impl   = target[name];
    const result = impl.apply(target, payload.args);

    return (result === undefined) ? null : result;
  }

  /**
   * "Refreshes" this instance in terms of access time. This is no different
   * than just saying `this.target` and merely exists so as to provide a solid
   * way to convey intent at the call sites for this method.
   */
  refresh() {
    if (this._lastAccess !== EVERGREEN) {
      this._lastAccess = Date.now();
    }
  }

  /**
   * Sets this instance to be "evergreen," that is, to never be considered
   * idle.
   */
  setEvergreen() {
    this._lastAccess = EVERGREEN;
  }

  /**
   * Takes a timestamp (standard Unix-ish msec) and indicates whether this
   * instance was considered idle as of that time.
   *
   * @param {Int} whenMsec Timestamp which the questions is with respect to.
   * @returns {boolean} `true` iff this instance has been idle since `whenMsec`
   *   or earlier.
   */
  wasIdleAsOf(whenMsec) {
    const lastAccess = this._lastAccess;

    if (lastAccess === EVERGREEN) {
      return false;
    } else {
      return (lastAccess <= whenMsec);
    }
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
}
