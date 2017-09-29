// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt, TString } from 'typecheck';
import { CommonBase, Functor } from 'util-common';

/**
 * The main "envelope" of a message being sent from client to server to requrest
 * action.
 */
export default class Message extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Int} id Message ID, used to match requests and responses. Must be
   *   a non-negative integer.
   * @param {string} target ID of the target object to send to.
   * @param {Functor} payload The name of the method to call and the arguments
   *   to call it with.
   */
  constructor(id, target, payload) {
    super();

    /** {Int} Message ID. */
    this._id = TInt.nonNegative(id);

    /** {string} ID of the target object. */
    this._target = TString.nonEmpty(target);

    /**
     * {Functor} The name of the method to call and the arguments to call it
     * with.
     */
    this._payload = Functor.check(payload);

    Object.freeze(this);
  }

  /**
   * Converts this instance to codec reconstruction arguments.
   *
   * @returns {array} Reconstruction arguments.
   */
  toCodecArgs() {
    return [this._id, this._target, this._payload];
  }

  /**
   * Converts this instance to a form suitable for logging.
   *
   * @returns {object} Log-appropriate form.
   */
  toLog() {
    return {
      id:      this._id,
      target:  this._target,
      payload: this._payload
    };
  }

  /** {Int} Message ID. */
  get id() {
    return this._id;
  }

  /**
   * {Functor} The name of the method to call and the arguments to call it
   * with.
   */
  get payload() {
    return this._payload;
  }

  /** {string} ID of the target object. */
  get target() {
    return this._target;
  }
}
