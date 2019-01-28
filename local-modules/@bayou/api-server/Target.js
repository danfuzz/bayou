// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseKey, TargetId } from '@bayou/api-common';
import { TObject } from '@bayou/typecheck';
import { CommonBase, Errors, Functor } from '@bayou/util-common';

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
   * @param {string|BaseKey} idOrKey Either the ID of the target (if
   *   uncontrolled) _or_ the key which controls access to the target. In the
   *   latter case, the target's `id` is considered to be the same as the key's
   *   `id`.
   * @param {object} directObject Object to be represented by this instance.
   * @param {Schema|null} schema `directObject`'s schema, if already known.
   */
  constructor(idOrKey, directObject, schema = null) {
    super();

    /**
     * {BaseKey|null} The access key, or `null` if this is an uncontrolled
     * target.
     */
    this._key = (idOrKey instanceof BaseKey) ? idOrKey : null;

    /** {string} The target ID. */
    this._id = TargetId.check((this._key === null) ? idOrKey : this._key.id);

    /**
     * {object} The object which this instance represents, wraps, and generally
     * provides access to.
     */
    this._directObject = TObject.check(directObject);

    /** {Schema} Schema for {@link #_directObject}. */
    this._schema = schema || new Schema(directObject);

    /**
     * {Int|'evergreen'} Timestamp (msec) when the {@link #directObject} was
     * last accessed or called, or the string constant `evergreen` to indicate
     * that this instance should never be considered idle. This is used to drive
     * automated cleanup of idle targets mapped by instances of
     * {@link api-server.Context}.
     */
    this._lastAccess = Date.now();

    Object.seal(this);
  }

  /**
  * {object} The object which this instance represents, wraps, and generally
  * provides access to. Accessing this property indicates that this instance is
  * _not_ currently idle.
  */
  get directObject() {
    this.refresh();
    return this._directObject;
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

  /** {Schema} The schema of {@link #directObject}. */
  get schema() {
    return this._schema;
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

    this.refresh();

    const obj  = this._directObject;
    const impl = obj[name];

    return impl.apply(obj, payload.args);
  }

  /**
   * "Refreshes" this instance in terms of access time. This is no different
   * than just saying `this.directObject` (and ignoring the result). It exists
   * as an explicitly different method so as to provide a solid way to convey
   * intent at call sites.
   */
  refresh() {
    if (this._lastAccess !== EVERGREEN) {
      this._lastAccess = Date.now();
    }
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
}
