// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseOp } from '@bayou/ot-common';
import { TString } from '@bayou/typecheck';
import { Errors } from '@bayou/util-common';

import { Property } from './Property';

/**
 * Operation which can be applied to a `PropertySnapshot`.
 */
export class PropertyOp extends BaseOp {
  /** {string} Opcode constant for "delete property" operations. */
  static get CODE_delete() {
    return 'delete';
  }

  /** {string} Opcode constant for "set property" operations. */
  static get CODE_set() {
    return 'set';
  }

  /**
   * Constructs a new "delete property" operation.
   *
   * @param {string} name Name of the property being deleted. Must be an
   *   "identifier" string.
   * @returns {PropertyOp} An appropriately-constructed operation.
   */
  static op_delete(name) {
    TString.identifier(name);

    return new PropertyOp(PropertyOp.CODE_delete, name);
  }

  /**
   * Constructs a new "set property" operation.
   *
   * @param {string} name Name of the property being set. Must be an
   *   "identifier" string.
   * @param {*} value Value of the property. Must be a pure data value.
   * @returns {PropertyOp} An appropriately-constructed operation.
   */
  static op_set(name, value) {
    return new PropertyOp(PropertyOp.CODE_set, new Property(name, value));
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
      case PropertyOp.CODE_delete: {
        const [name] = payload.args;
        return Object.freeze({ opName, name });
      }

      case PropertyOp.CODE_set: {
        const [property] = payload.args;
        return Object.freeze({ opName, property });
      }

      default: {
        throw Errors.wtf(`Weird operation name: ${opName}`);
      }
    }
  }

  /**
   * Subclass-specific implementation of {@link #isValidPayload}.
   *
   * @param {Functor} payload_unused The would-be payload for an instance.
   * @returns {boolean} `true` if `payload` is valid, or `false` if not.
   */
  static _impl_isValidPayload(payload_unused) {
    // **TODO:** Fill this in!
    return true;
  }
}
