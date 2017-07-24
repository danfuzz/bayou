// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt, TString } from 'typecheck';
import { ColorSelector } from 'util-common';

import RevisionNumber from './RevisionNumber';

const KEY = Symbol('CaretOp constructor key');

export default class CaretOp {
  /** {string} Operation name for "begin session" operations. */
  static get BEGIN_SESSION() {
    return 'begin-session';
  }

  /** {string} Operation name for "update caret" operations. */
  static get UPDATE_CARET() {
    return 'update-caret';
  }

  /** {string} Operation name for "end session" operations. */
  static get END_SESSION() {
    return 'end-session';
  }

  /** {string} Operation name for "update document rev-num" operations. */
  static get UPDATE_DOC_REV_NUM() {
    return 'update-doc-rev-num';
  }

  /**
   * Constructs a new "begin session" operation.
   *
   * @param {string} sessionId The session ID.
   * @returns {CaretOp} An operation representing the start of the so-IDed
   *   session.
   */
  static op_beginSession(sessionId) {
    TString.check(sessionId);

    const args = new Map();

    args.set('sessionId', sessionId);

    return new CaretOp(KEY, CaretOp.BEGIN_SESSION, args);
  }

  /**
   * Constructs a new "update caret" operation.
   *
   * @param {string} sessionId The session id for the author whose selection is changing.
   * @param {Int} index The starting point of the new selection.
   * @param {Int} length The length o the selection, or zero if the update represents
   *   a mere insertion point movement rather than a selection.
   * @param {string} color The color to use for the background of the referenced author's selection.
   *   It must be in three-byte CSS hex for (e.g. `'#fa9cb3'`).
   * @returns {CaretOp} An operation representing new caret information for a
   *   particular session.
   */
  static op_updateCaret(sessionId, index, length, color) {
    TString.check(sessionId);
    TInt.min(index, 0);
    TInt.min(length, 0);
    ColorSelector.checkHexColor(color);

    const args = new Map();

    args.set('sessionId', sessionId);
    args.set('index', index);
    args.set('length', length);
    args.set('color', color);

    return new CaretOp(KEY, CaretOp.UPDATE_CARET, args);
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

    const args = new Map();

    args.set('sessionId', sessionId);

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

    const args = new Map();

    args.set('docRevNum', docRevNum);

    return new CaretOp(KEY, CaretOp.UPDATE_DOC_REV_NUM, args);
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
    const args = {};

    // TODO: We need a codec for `Map`s. Or, more particularly here, we need to
    // not use JSON strings as part of the coding form.
    this._args.forEach((k, v) => { args.set(k, v); });

    return [this._name, JSON.stringify(args)];
  }

  /**
   * Instaniate a new instance of this class from API arguments.
   *
   * @param {string} name The name of the operation.
   * @param {string} argsJson The JSON-encoded arguments for this operation.
   * @returns {CaretOp} The new instance.
   */
  static fromApi(name, argsJson) {
    const argsObj = JSON.parse(argsJson);
    const args = new Map();

    for (const k of Object.keys(argsObj)) {
      args.set(k, argsObj[k]);
    }

    return new CaretOp(KEY, name, args);
  }
}
