// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TArray, TInt, TString } from 'typecheck';

/**
 * The main "envelope" of a message being sent from client to server to requrest
 * action.
 */
export default class Message {
  /**
   * Constructs an instance.
   *
   * @param {Int} id Message ID, used to match requests and responses. Must be
   *   a non-negative integer.
   * @param {string} target ID of the target object to send to.
   * @param {string} name Method (or property) name to access.
   * @param {array<*>} args Arguments to include with the message.
   */
  constructor(id, target, name, args) {
    /** {Int} Message ID. */
    this._id = TInt.nonNegative(id);

    /** {string} ID of the target object. */
    this._target = TString.nonempty(target);

    /** {string} Method / property name to access. */
    this._name = TString.nonempty(name);

    /** {array<*>} Arguments of the message. */
    this._args = TArray.check(args);

    Object.freeze(this);
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._id, this._target, this._name, this._args];
  }

  /**
   * Converts this instance to a form suitable for logging.
   *
   * @returns {object} Log-appropriate form.
   */
  toLog() {
    return {
      id:     this._id,
      target: this._target,
      name:   this._name,
      args:   this._args
    };
  }

  /** {Int} Message ID. */
  get id() {
    return this._id;
  }

  /** {string} ID of the target object. */
  get target() {
    return this._target;
  }

  /** {string} Method / property name to access. */
  get name() {
    return this._name;
  }

  /** {array<*>} Arguments of the message. */
  get args() {
    return this._args;
  }
}
