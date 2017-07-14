// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt, TString } from 'typecheck';
import { ColorSelector } from 'util-common';

const KEY = Symbol('CaretOp constructor key');

const BEGIN_AUTHOR_SESSION_OP = 'BEGIN_AUTHOR_SESSION_OP';
const UPDATE_AUTHOR_SELECTION_OP = 'UPDATE_AUTHOR_SELECTION_UP';
const END_AUTHOR_SESSION_OP = 'END_AUTHOR_SESSION_OP';

export default class CaretOp {
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

  static op_addAuthor(sessionId) {
    TString.check(sessionId);

    const args = new Map();

    args.set('sessionId', sessionId);

    return new CaretOp(KEY, BEGIN_AUTHOR_SESSION_OP, args);
  }

  static op_updateAuthorSelection(sessionId, index, length, color) {
    TString.check(sessionId);
    TInt.min(0, index);
    TInt.min(0, length);
    TString.check(color, ColorSelector.HEX_COLOR_REGEXP);

    const args = new Map();

    args.set('sessionId', sessionId);
    args.set('index', index);
    args.set('length', length);
    args.set('color', color);

    return new CaretOp(KEY, UPDATE_AUTHOR_SELECTION_OP, args);
  }

  static op_removeAuthor(sessionId) {
    TString.check(sessionId);

    const args = new Map();

    args.set('sessionId', sessionId);

    return new CaretOp(KEY, END_AUTHOR_SESSION_OP, args);
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
