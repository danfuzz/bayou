// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';
import { Errors } from 'util-common';

import BaseOp from './BaseOp';
import Caret from './Caret';

/**
 * Operation which can be applied to a `Caret` or `CaretSnapshot`.
 */
export default class CaretOp extends BaseOp {
  /** {string} Operation name for "begin session" operations. */
  static get BEGIN_SESSION() {
    return 'begin_session';
  }

  /** {string} Operation name for "end session" operations. */
  static get END_SESSION() {
    return 'end_session';
  }

  /** {string} Operation name for "set field" operations. */
  static get SET_FIELD() {
    return 'set_field';
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

    return new CaretOp(CaretOp.BEGIN_SESSION, caret);
  }

  /**
   * Constructs a new "end session" operation.
   *
   * @param {string} sessionId ID of the session.
   * @returns {CaretOp} The corresponding operation.
   */
  static op_endSession(sessionId) {
    TString.nonEmpty(sessionId);

    return new CaretOp(CaretOp.END_SESSION, sessionId);
  }

  /**
   * Constructs a new "set caret field" operation.
   *
   * @param {string} sessionId Session for the caret to update.
   * @param {string} key Name of the field to update.
   * @param {*} value New value for the so-named field. Type restriction on this
   *   varies by name.
   * @returns {CaretOp} The corresponding operation.
   */
  static op_setField(sessionId, key, value) {
    TString.nonEmpty(sessionId);
    Caret.checkField(key, value);

    return new CaretOp(CaretOp.SET_FIELD, sessionId, key, value);
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
      case CaretOp.BEGIN_SESSION: {
        const [caret] = payload.args;
        return Object.freeze({ opName, caret });
      }

      case CaretOp.END_SESSION: {
        const [sessionId] = payload.args;
        return Object.freeze({ opName, sessionId });
      }

      case CaretOp.SET_FIELD: {
        const [sessionId, key, value] = payload.args;
        return Object.freeze({ opName, sessionId, key, value });
      }

      default: {
        throw Errors.wtf(`Weird operation name: ${opName}`);
      }
    }
  }
}
