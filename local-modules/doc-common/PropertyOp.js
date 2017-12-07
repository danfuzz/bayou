// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseOp } from 'ot-common';
import { TString } from 'typecheck';
import { Errors } from 'util-common';

import Property from './Property';

/**
 * Operation which can be applied to a `PropertySnapshot`.
 */
export default class PropertyOp extends BaseOp {
  /** {string} Operation name for "delete property" operations. */
  static get DELETE_PROPERTY() {
    return 'delete_property';
  }

  /** {string} Operation name for "set property" operations. */
  static get SET_PROPERTY() {
    return 'set_property';
  }

  /**
   * Constructs a new "delete property" operation.
   *
   * @param {string} name Name of the property being deleted. Must be an
   *   "identifier" string.
   * @returns {PropertyOp} An appropriately-constructed operation.
   */
  static op_deleteProperty(name) {
    TString.identifier(name);

    return new PropertyOp(PropertyOp.DELETE_PROPERTY, name);
  }

  /**
   * Constructs a new "set property" operation.
   *
   * @param {string} name Name of the property being set. Must be an
   *   "identifier" string.
   * @param {*} value Value of the property. Must be a pure data value.
   * @returns {PropertyOp} An appropriately-constructed operation.
   */
  static op_setProperty(name, value) {
    return new PropertyOp(PropertyOp.SET_PROPERTY, new Property(name, value));
  }

  /**
   * {object} The properties of this operation, as a conveniently-accessed
   * plain object. `opName` is always bound to the operation name. Other
   * bindings depend on the operation name. Guaranteed to be an immutable
   * object.
   */
  get props() {
    const payload = this._payload;
    const opName  = payload.name;

    switch (opName) {
      case PropertyOp.DELETE_PROPERTY: {
        const [name] = payload.args;
        return Object.freeze({ opName, name });
      }

      case PropertyOp.SET_PROPERTY: {
        const [property] = payload.args;
        return Object.freeze({ opName, property });
      }

      default: {
        throw Errors.wtf(`Weird operation name: ${opName}`);
      }
    }
  }
}
