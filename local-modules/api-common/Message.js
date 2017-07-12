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
   * Constructs an error instance. This form is used to convey the fact that a
   * received message was malformed.
   *
   * @param {Int} id Message ID. Must be a non-negative integer or `-1`. `-1`
   *   is used when it wasn't even possible to determine the ID.
   * @param {string} message The error message.
   * @returns {Message} An appropriately-constructed instance of this class.
   */
  static error(id, message) {
    TString.nonempty(message);
    return new Message(id, 'error', 'error', 'error', [message]);
  }

  /**
   * Constructs an instance. **Note:** The parameter descriptions below are for
   * non-error instances. To construct an error instance, use the static method
   * `error()`.
   *
   * @param {Int} id Message ID, used to match requests and responses. Must be
   *   a non-negative integer.
   * @param {string} target ID of the target object to send to.
   * @param {string} action Kind of action to take. Currently, the only valid
   *   values are `call`.
   * @param {string} name Method (or property) name to access.
   * @param {Array<*>} args Arguments to include with the message.
   */
  constructor(id, target, action, name, args) {
    /** {Int} Message ID. `-1` is only used in case of (some) errors. */
    this._id = TInt.min(id, -1);

    /** {string} ID of the target object. */
    this._target = TString.nonempty(target);

    /** {string} Action to take / being taken. */
    this._action = TString.nonempty(action);

    /** {string} Method / property name to access. */
    this._name = TString.nonempty(name);

    /** {Array<*>} Arguments of the message. */
    this._args = TArray.check(args);

    // Validate `action`.
    switch (action) {
      case 'call':
      case 'error': {
        // Valid.
        break;
      }
      default: {
        throw new Error(`Invalid value for \`action\`: \`${action}\``);
      }
    }

    // Validate `id` wrt error-vs-not.
    if ((action !== 'error') && (id === -1)) {
      throw new Error('Invalid value for non-error `id`: -1');
    }

    Object.freeze(this);
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._id, this._target, this._action, this._name, this._args];
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
      action: this._action,
      name:   this._name,
      args:   this._args
    };
  }

  /**
   * Indicates whether this instance represents an error.
   *
   * @returns {boolean} `true` iff this is an error instance.
   */
  isError() {
    return (this._action === 'error');
  }

  /**
   * {string|null} The error message of this instance, if it is indeed an error
   * instance, or `null` if this is a non-error instance.
   */
  get errorMessage() {
    return this.isError() ? this._args[0] : null;
  }

  /** {Int} Message ID. */
  get id() {
    return this._id;
  }

  /** {string} ID of the target object. */
  get target() {
    return this._target;
  }

  /** {string} Action to take / being taken. */
  get action() {
    return this._action;
  }

  /** {string} Method / property name to access. */
  get name() {
    return this._name;
  }

  /** {Array<*>} Arguments of the message. */
  get args() {
    return this._args;
  }
}
