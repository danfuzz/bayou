// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt } from '@bayou/typecheck';
import { CommonBase, Functor } from '@bayou/util-common';

import TargetId from './TargetId';

/**
 * Message being sent from client to server to requrest action. This includes
 * a message ID, target address, and a main payload indicating a method name
 * and arguments.
 */
export default class Message extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Int} id Message ID, used to match requests and responses. Must be
   *   a non-negative integer.
   * @param {string} targetId ID of the target object to send to.
   * @param {Functor} payload The name of the method to call and the arguments
   *   to call it with.
   */
  constructor(id, targetId, payload) {
    super();

    /** {Int} Message ID. */
    this._id = TInt.nonNegative(id);

    /** {string} ID of the target object. */
    this._targetId = TargetId.check(targetId);

    /**
     * {Functor} The name of the method to call and the arguments to call it
     * with.
     */
    this._payload = Functor.check(payload);

    Object.freeze(this);
  }

  /**
   * Gets reconstruction arguments for this instance.
   *
   * @returns {array<*>} Reconstruction arguments.
   */
  deconstruct() {
    return [this._id, this._targetId, this._payload];
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
  get targetId() {
    return this._targetId;
  }

  /**
   * Returns a new instance just like `this` except with the `targetId` as
   * given.
   *
   * @param {string} targetId The new target ID.
   * @returns {Message} An appropriately-constructed instance.
   */
  withTargetId(targetId) {
    return new Message(this._id, targetId, this._payload);
  }
}
