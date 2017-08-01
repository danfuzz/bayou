// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';
import { CommonBase } from 'util-common';

import Caret from './Caret';
import RevisionNumber from './RevisionNumber';

/** {Symbol} Key which protects the constructor from being called improperly. */
const KEY = Symbol('CaretOp constructor key');

/**
 * Operation which can be applied to a `Caret` or `CaretSnapshot`.
 */
export default class CaretOp extends CommonBase {
  /** {string} Operation name for "begin session" operations. */
  static get BEGIN_SESSION() {
    return 'begin-session';
  }

  /** {string} Operation name for "update field" operations. */
  static get UPDATE_FIELD() {
    return 'update-field';
  }

  /** {string} Operation name for "end session" operations. */
  static get END_SESSION() {
    return 'end-session';
  }

  /** {string} Operation name for "update document rev-num" operations. */
  static get UPDATE_DOC_REV_NUM() {
    return 'update-doc-rev-num';
  }

  /** {string} Operation name for "update rev-num" operations. */
  static get UPDATE_REV_NUM() {
    return 'update-rev-num';
  }

  /**
   * Constructs a new "begin session" operation.
   *
   * @param {Caret} caret The initial caret for the new session (which includes
   *   a session ID).
   * @returns {CaretOp} An operation representing the start of the so-IDed
   *   session.
   */
  static op_beginSession(caret) {
    Caret.check(caret);

    const args = new Map(Object.entries({ caret }));

    return new CaretOp(KEY, CaretOp.BEGIN_SESSION, args);
  }

  /**
   * Constructs a new "update caret field" operation.
   *
   * @param {string} sessionId Session for the caret to update.
   * @param {string} key Name of the field to update.
   * @param {*} value New value for the so-named field. Type restriction on this
   *   varies by name.
   * @returns {CaretOp} An operation representing the update of the indicated
   *   field on the indicated caret.
   */
  static op_updateField(sessionId, key, value) {
    TString.check(sessionId);
    Caret.checkField(key, value);

    const args = new Map(Object.entries({ sessionId, key, value }));

    return new CaretOp(KEY, CaretOp.UPDATE_FIELD, args);
  }

  /**
   * Constructs a new "end session" operation.
   *
   * @param {string} sessionId ID of the session.
   * @returns {CaretOp} An operation representing the end of the so-IDed
   *   session.
   */
  static op_endSession(sessionId) {
    TString.check(sessionId);

    const args = new Map(Object.entries({ sessionId }));

    return new CaretOp(KEY, CaretOp.END_SESSION, args);
  }

  /**
   * Constructs a new instance of an update-doc-rev-num operation.
   *
   * @param {Int} docRevNum The new revision number.
   * @returns {CaretOp} The corresponding operation.
   */
  static op_updateDocRevNum(docRevNum) {
    RevisionNumber.check(docRevNum);

    const args = new Map(Object.entries({ docRevNum }));

    return new CaretOp(KEY, CaretOp.UPDATE_DOC_REV_NUM, args);
  }

  /**
   * Constructs a new instance of an update-rev-num operation.
   *
   * @param {Int} revNum The new revision number.
   * @returns {CaretOp} The corresponding operation.
   */
  static op_updateRevNum(revNum) {
    RevisionNumber.check(revNum);

    const args = new Map(Object.entries({ revNum }));

    return new CaretOp(KEY, CaretOp.UPDATE_REV_NUM, args);
  }

  /**
   * Constructs an instance. This should not be used directly. Instead, used
   * the static constructor methods defined by this class.
   *
   * @param {object} constructorKey The private-to-this-module key that
   *   enforces the exhortation in the method documentation above.
   * @param {string} name The operation name.
   * @param {Map<string,*>} args Arguments to the operation.
   */
  constructor(constructorKey, name, args) {
    super();

    if (constructorKey !== KEY) {
      throw new Error('Constructor is private');
    }

    /** {string} name The name of this operation. */
    this._name = name;

    /** {Map<string,*>} args The arguments needed for the operation. */
    this._args = args;

    Object.freeze(this);
  }

  /**
   * @returns {string} The name of this operation.
   */
  get name() {
    return this._name;
  }

  /**
   * Gets the operation argument with the given name. It is an error to
   * request an argument that is not bound. Return values are guaranteed to be
   * deep frozen.
   *
   * @param {string} name The argument name.
   * @returns {*} Corresponding argument value.
   */
  arg(name) {
    const result = this._args.get(name);

    if (result === undefined) {
      throw new Error(`No such argument: ${name}`);
    }

    return result;
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    // Convert the `_args` map to a simple object for the purpose of coding.
    const args = {};
    for (const [k, v] of this._args) {
      args[k] = v;
    }

    return [this._name, args];
  }

  /**
   * Makes a new instance of this class from API arguments.
   *
   * @param {string} name The name of the operation.
   * @param {object} args The arguments for the operation, as a simple object
   *   (not a map).
   * @returns {CaretOp} The new instance.
   */
  static fromApi(name, args) {
    return new CaretOp(KEY, name, new Map(Object.entries(args)));
  }
}
