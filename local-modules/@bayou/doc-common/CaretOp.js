// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseOp } from '@bayou/ot-common';
import { Errors } from '@bayou/util-common';

import Caret from './Caret';
import CaretId from './CaretId';

/**
 * Operation which can be applied to a `Caret` or `CaretSnapshot`.
 */
export default class CaretOp extends BaseOp {
  /** {string} Opcode constant for "begin session" operations. */
  static get CODE_beginSession() {
    return 'beginSession';
  }

  /** {string} Opcode constant for "end session" operations. */
  static get CODE_endSession() {
    return 'endSession';
  }

  /** {string} Opcode constant for "set field" operations. */
  static get CODE_setField() {
    return 'setField';
  }

  /**
   * Constructs a new "begin session" operation.
   *
   * @param {Caret} caret The initial caret for the new session (which includes
   *   a session ID).
   * @returns {CaretOp} The corresponding operation.
   */
  static op_beginSession(caret) {
    Caret.check(caret);

    return new CaretOp(CaretOp.CODE_beginSession, caret);
  }

  /**
   * Constructs a new "end session" operation.
   *
   * @param {string} caretId ID of the caret which is to be removed.
   * @returns {CaretOp} The corresponding operation.
   */
  static op_endSession(caretId) {
    CaretId.check(caretId);

    return new CaretOp(CaretOp.CODE_endSession, caretId);
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
      case CaretOp.CODE_beginSession: {
        const [caret] = payload.args;
        return Object.freeze({ opName, caret });
      }

      case CaretOp.CODE_endSession: {
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

  // TODO: implement caret op specific validation
  _impl_validate() {
    return true;
  }
}
