// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt, TString } from '@bayou/typecheck';
import { CommonBase, Functor } from '@bayou/util-common';

import BearerToken from './BearerToken';
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
   * @param {Int|string} id Message ID, used to match requests and responses.
   *   Must be a non-negative integer or a string of at least eight characters.
   * @param {string|BearerToken} targetId ID of the target object to send to. If
   *   this is a {@link BearerToken}, then {@link BearerToken#secretToken} is
   *   taken to be the actual ID.
   * @param {Functor} payload The name of the method to call and the arguments
   *   to call it with.
   */
  constructor(id, targetId, payload) {
    super();

    /** {Int|string} Message ID. */
    this._id = ((typeof id) === 'number')
      ? TInt.nonNegative(id)
      : TString.minLen(id, 8);

    /** {string|BearerToken} ID of the target object. */
    this._targetId = TargetId.orToken(targetId);

    /**
     * {Functor} The name of the method to call and the arguments to call it
     * with.
     */
    this._payload = Functor.check(payload);

    Object.freeze(this);
  }

  /**
   * Gets reconstruction arguments for this instance. If constructed with a
   * {@link BearerToken} for `targetId`, the result of this method instead
   * includes {@link BearerToken#secretToken} instead of the token object itself
   * (since {@link BearerToken} isn't generally codec-encodable).
   *
   * @returns {array<*>} Reconstruction arguments.
   */
  deconstruct() {
    return [this._id, this.targetId, this._payload];
  }

  /** {Int|string} Message ID. */
  get id() {
    return this._id;
  }

  /**
   * {object} Ad-hoc object with the contents of this instance, suitable for
   * logging. In particular, the {@link #targetId} is represented in redacted
   * form if this instance was constructed with a {@link BearerToken}.
   *
   * **Note:** The {@link #payload} is _not_ redacted, as doing so requires
   * information not present in this class (namely, the actual object to which
   * the {@link #targetId} is bound).
   */
  get logInfo() {
    const id       = this._id;
    const targetId = TargetId.safeString(this._targetId);
    const payload  = this._payload;

    return { id, targetId, payload };
  }

  /**
   * {Functor} The name of the method to call and the arguments to call it
   * with.
   */
  get payload() {
    return this._payload;
  }

  /**
   * {string} ID of the target object. If constructed with a {@link BearerToken}
   * for `targetId`, this value is the token's {@link BearerToken#secretToken}.
   */
  get targetId() {
    const targetId = this._targetId;

    return (targetId instanceof BearerToken) ? targetId.secretToken : targetId;
  }

  /**
   * Returns a new instance just like `this` except with the `targetId` as
   * given.
   *
   * @param {string|BearerToken} targetId The new target ID (or token
   *   representative of same).
   * @returns {Message} An appropriately-constructed instance.
   */
  withTargetId(targetId) {
    return new Message(this._id, targetId, this._payload);
  }
}
