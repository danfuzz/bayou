// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt, TString } from 'typecheck';
import { ColorSelector } from 'util-common';

import RevisionNumber from './RevisionNumber';

const KEY = Symbol('CaretOp constructor key');

export default class CaretOp {
  static get BEGIN_AUTHOR_SESSION_OP() {
    return 'begin-author-session-op';
  }

  static get UPDATE_AUTHOR_SELECTION_OP() {
    return 'update-author-selection-op';
  }

  static get END_AUTHOR_SESSION_OP() {
    return 'end-author-session-op';
  }

  static get UPDATE_DOC_REV_NUM_OP() {
    return 'update-doc-rev-num-op';
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
   * @returns {Map<string, *>} The arguments needed for this operation.
   */
  get args() {
    /* TODO: _args is at risk for mutation */
    return this._args;
  }

  /**
   * Constructs a new instance of an add-author operation.
   *
   * @param {string} sessionId An author-editing session id.
   * @returns {CaretOp} The operation representing the addition of the referenced author.
   */
  static op_addAuthor(sessionId) {
    TString.check(sessionId);

    const args = new Map();

    args.set('sessionId', sessionId);

    return new CaretOp(KEY, CaretOp.BEGIN_AUTHOR_SESSION_OP, args);
  }

  /**
   * Constructs a new instance of an update-selection operation.
   *
   * @param {string} sessionId The session id for the author whose selection is changing.
   * @param {Int} index The starting point of the new selection.
   * @param {Int} length The length o the selection, or zero if the update represents
   *   a mere insertion point movement rather than a selection.
   * @param {string} color The color to use for the background of the referenced author's selection.
   *   It must be in three-byte CSS hex for (e.g. `'#fa9cb3'`).
   * @returns {CaretOp} The operation representing the additoin of the referenced author.
   */
  static op_updateAuthorSelection(sessionId, index, length, color) {
    TString.check(sessionId);
    TInt.min(index, 0);
    TInt.min(length, 0);
    ColorSelector.checkHexColor(color);

    const args = new Map();

    args.set('sessionId', sessionId);
    args.set('index', index);
    args.set('length', length);
    args.set('color', color);

    return new CaretOp(KEY, CaretOp.UPDATE_AUTHOR_SELECTION_OP, args);
  }

  /**
   * Constructs a new instance of a remove-author operation.
   *
   * @param {string} sessionId An author-editing session id.
   * @returns {CaretOp} The operation representing the removal of the referenced author.
   */
  static op_removeAuthor(sessionId) {
    TString.check(sessionId);

    const args = new Map();

    args.set('sessionId', sessionId);

    return new CaretOp(KEY, CaretOp.END_AUTHOR_SESSION_OP, args);
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

    return new CaretOp(KEY, CaretOp.UPDATE_DOC_REV_NUM_OP, args);
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    const args = {};

    /* TODO: we need a codec for `Map`s. */
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
