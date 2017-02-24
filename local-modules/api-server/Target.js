// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TObject } from 'typecheck';

import Schema from './Schema';

/**
 * Wrapper for an object which is callable through the API.
 */
export default class Target {
  /**
   * Constructs an instance which wraps the given object.
   *
   * @param {object} target Object from which to derive the schema.
   */
  constructor(target) {
    /** {object} The target object. */
    this._target = TObject.check(target);

    /** {Schema} Schema for the target. */
    this._schema = new Schema(target);

    Object.freeze(this);
  }

  /** {object} The underlying target object. */
  get target() {
    return this._target;
  }

  /** {Schema} The target's schema. */
  get schema() {
    return this._schema;
  }
}
