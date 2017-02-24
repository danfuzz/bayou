// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TArray, TObject, TString } from 'typecheck';

import Schema from './Schema';

/**
 * Wrapper for an object which is callable through the API.
 */
export default class Target {
  /**
   * Constructs an instance which wraps the given object.
   *
   * @param {string} name Name of the target. Used for error messages.
   * @param {object} target Object from which to derive the schema.
   */
  constructor(name, target) {
    /** {string} The target name. */
    this._name = TString.check(name);

    /** {object} The target object. */
    this._target = TObject.check(target);

    /** {Schema} Schema for the target. */
    this._schema = new Schema(target);

    Object.freeze(this);
  }

  /** {string} The target name. */
  get name() {
    return this._name;
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
   * Queues up an instance method call on the target object, for execution in a
   * later turn. Returns a promise for the result. This will throw an error
   * promptly (that is, _not_ return a promise) if the arguments passed to this
   * method are invalid _including_ if `name` doesn't correspond to an instance
   * method of the target.
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

    return new Promise((res, rej) => {
      try {
        res(impl.apply(target, args));
      } catch (e) {
        rej(e);
      }
    });
  }
}
