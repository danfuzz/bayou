// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';
import { CommonBase, DataUtil, Errors, Functor } from 'util-common';

import Caret from './Caret';

/**
 * Operation which can be applied to a `Caret` or `CaretSnapshot`.
 */
export default class CaretOp extends CommonBase {
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

    return new CaretOp(new Functor(CaretOp.BEGIN_SESSION, caret));
  }

  /**
   * Constructs a new "end session" operation.
   *
   * @param {string} sessionId ID of the session.
   * @returns {CaretOp} The corresponding operation.
   */
  static op_endSession(sessionId) {
    TString.check(sessionId);

    return new CaretOp(new Functor(CaretOp.END_SESSION, sessionId));
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
    TString.check(sessionId);
    Caret.checkField(key, value);

    return new CaretOp(new Functor(CaretOp.SET_FIELD, sessionId, key, value));
  }

  /**
   * Constructs an instance. This should not be used directly. Instead, used
   * the static constructor methods defined by this class.
   *
   * @param {Functor} payload The operation payload (name and arguments).
   */
  constructor(payload) {
    super();

    /** {Functor} payload The operation payload (name and arguments). */
    this._payload = Functor.check(payload);

    Object.freeze(this);
  }

  /** {Functor} The operation payload (name and arguments). */
  get payload() {
    return this._payload;
  }

  /**
   * {object} The properties of this operation, as a conveniently-accessed
   * simple object. `opName` is always bound to the operation name. Other
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

      case CaretOp.SET_REV_NUM: {
        const [revNum] = payload.args;
        return Object.freeze({ opName, revNum });
      }

      default: {
        throw Errors.wtf(`Weird operation name: ${opName}`);
      }
    }
  }

  /**
   * Compares this to another possible-instance, for equality of content.
   *
   * @param {*} other Value to compare to.
   * @returns {boolean} `true` iff `other` is also an instance of this class,
   *   and `this` and `other` have equal contents.
   */
  equals(other) {
    if (this === other) {
      return true;
    } else if (!(other instanceof CaretOp)) {
      return false;
    }

    const p1 = this._payload;
    const p2 = other._payload;

    // **TODO:** This should just be `Functor.equals()`, except that method
    // needs to be able to use `equals()` on elements.

    if (p1.name !== p2.name) {
      return false;
    }

    if (DataUtil.equalData(p1.args, p2.args)) {
      return true;
    }

    return (p1.name === CaretOp.BEGIN_SESSION) && p1.args[0].equals(p2.args[0]);
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._payload];
  }

  /**
   * Gets a human-oriented string representation of this instance.
   *
   * @returns {string} The human-oriented representation.
   */
  toString() {
    return `${this.constructor.name} { ${this._payload} }`;
  }
}
