// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseOp } from '@bayou/ot-common';
import { Errors } from '@bayou/util-common';

import { Caret } from './Caret';
import { CaretId } from './CaretId';

/**
 * Operation which can be applied to a `Caret` or `CaretSnapshot`.
 */
export class CaretOp extends BaseOp {
  /** {string} Opcode constant for "add" operations (add a new caret). */
  static get CODE_add() {
    return 'add';
  }

  /** {string} Opcode constant for "delete" operations (delete a caret). */
  static get CODE_delete() {
    return 'delete';
  }

  /** {string} Opcode constant for "set field" operations. */
  static get CODE_setField() {
    return 'setField';
  }

  /**
   * Constructs a new "add" operation.
   *
   * @param {Caret} caret The caret to add.
   * @returns {CaretOp} The corresponding operation.
   */
  static op_add(caret) {
    Caret.check(caret);

    return new CaretOp(CaretOp.CODE_add, caret);
  }

  /**
   * Constructs a new "delete" operation.
   *
   * @param {string} caretId ID of the caret which is to be removed.
   * @returns {CaretOp} The corresponding operation.
   */
  static op_delete(caretId) {
    CaretId.check(caretId);

    return new CaretOp(CaretOp.CODE_delete, caretId);
  }

  /**
   * Constructs a new "set caret field" operation.
   *
   * @param {string} caretId ID of the caret to update.
   * @param {string} key Name of the field to update.
   * @param {*} value New value for the so-named field. Type restriction on this
   *   varies by name.
   * @returns {CaretOp} The corresponding operation.
   */
  static op_setField(caretId, key, value) {
    CaretId.check(caretId);
    Caret.checkField(key, value);

    return new CaretOp(CaretOp.CODE_setField, caretId, key, value);
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
      case CaretOp.CODE_add: {
        const [caret] = payload.args;
        return Object.freeze({ opName, caret });
      }

      case CaretOp.CODE_delete: {
        const [caretId] = payload.args;
        return Object.freeze({ opName, caretId });
      }

      case CaretOp.CODE_setField: {
        const [caretId, key, value] = payload.args;
        return Object.freeze({ opName, caretId, key, value });
      }

      default: {
        throw Errors.wtf(`Weird operation name: ${opName}`);
      }
    }
  }

  /**
   * {Int} Subclass-specific implementation of {@link #roughSize}.
   */
  get _impl_roughSize() {
    // **TODO:** Consider higher-fidelity implementation.
    return 1;
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
