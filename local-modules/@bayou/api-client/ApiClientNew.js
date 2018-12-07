// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseKey, CodableError, ConnectionError, Message, Remote, Response } from '@bayou/api-common';
import { Codec } from '@bayou/codec';
import { TString } from '@bayou/typecheck';
import { CommonBase, WebsocketCodes } from '@bayou/util-common';

import BaseServerConnection from './BaseServerConnection';
import TargetMap from './TargetMap';

/**
 * API connection with a server. This is a layer on top of
 * {@link BaseServerConnection} which provides API semantics, not just sending
 * and receiving of (uninterpreted) data blobs.
 *
 * **TODO:** This class is an as-yet nonfunctional work-in-progress. See the
 * header comment in {@link ApiClient} for more details.
 */
export default class ApiClientNew extends CommonBase {
  /**
   * Constructs an instance, which uses the indicated connection handler to
   * communicate with a server.
   *
   * @param {BaseServerConnection} connection Provider of the basic message
   *   sending and receiving facilities. This also encapsulates all knowledge
   *   of the network location of the far side of the connection (or, e.g.,
   *   mocking of same).
   * @param {Codec} codec Codec instance to use. In order to function properly,
   *   its registry must include all of the encodable classes defined in
   *   `@bayou/api-common` classes. See
   *   {@link @bayou/api-common.TheModule.registerCodecs}.
   */
  constructor(connection, codec) {
    super();

    /**
     * {BaseServerConnection} Provider of the basic message sending and
     * receiving facilities.
     */
    this._connection = BaseServerConnection.check(connection);

    /** {Codec} Codec instance to use. */
    this._codec = Codec.check(codec);

    /** {Int} Next message ID to use when sending a message. */
    this._nextId = 0;

    /**
     * {object<Int,{message, resolve, reject}>} Map from message IDs to response
     * callbacks and original message info (the latter for debugging). Each
     * element is an object that maps `resolve` and `reject` to functions that
     * obey the usual promise contract for functions of those names, and
     * `message` to the originally-sent {@link Message}.
     */
    this._callbacks = {};

    /**
     * {TargetMap} Map of names to target proxies. See {@link
     * TargetMap#constructor} for details about the argument.
     */
    this._targets = new TargetMap(this._send.bind(this));
    this._targets.add('meta'); // The one guaranteed target.

    /**
     * {Map<string, Promise<Proxy>>} Map from target IDs to promises of their
     * proxy, for each ID currently in the middle of being authorized. Used to
     * avoid re-issuing authorization requests.
     */
    this._pendingAuths = new Map();

    Object.seal(this);
  }

  /**
   * {string} The connection ID if known, or a reasonably suggestive string if
   * not. This class automatically sets the ID when connections get made, so
   * that clients of this class don't generally have to make an API call to find
   * it out.
   */
  get connectionId() {
    return this._connection.connectionId;
  }

  /**
   * {Logger} The client-specific logger.
   */
  get log() {
    return this._connection.log;
  }

  /**
   * {Proxy} The object upon which meta-API calls can be made.
   */
  get meta() {
    return this._targets.get('meta');
  }

  /**
   * Performs a challenge-response authorization for a given key. When the
   * returned promise resolves successfully, that means that the corresponding
   * target can be accessed without further authorization.
   *
   * If `key.id` is already mapped as a target, it is returned directly, without
   * further authorization. If it is in the middle of being authorized, the
   * existing pending promise for the target is returned. (That is, this method
   * is idempotent.)
   *
   * @param {BaseKey} key Key to authorize with.
   * @returns {Promise<Proxy>} Promise which resolves to the proxy that
   *   represents the foreign target which is controlled by `key`, once
   *   authorization is complete.
   */
  authorizeTarget(key) {
    BaseKey.check(key);

    const id   = key.id;
    const meta = this.meta;
    let result;

    result = this._targets.getOrNull(id);
    if (result !== null) {
      // The target is already authorized and bound. Return it.
      return result;
    }

    result = this._pendingAuths.get(id);
    if (result) {
      // We have already initiated authorization on this target. Return the
      // promise from the original initiation.
      this.log.info('Already authing:', id);
      return result;
    }

    // It's not yet bound as a target, and authorization isn't currently in
    // progress.

    result = (async () => {
      try {
        const challenge = await meta.makeChallenge(id);
        const response  = key.challengeResponseFor(challenge);

        this.log.event.gotChallenge(id, challenge);
        await meta.authWithChallengeResponse(challenge, response);

        // Successful auth.
        this.log.event.authed(id);
        this._pendingAuths.delete(id); // It's no longer pending.
        return this._targets.add(id);
      } catch (error) {
        // Trouble along the way. Clean out the pending auth, and propagate the
        // error.
        this.log.event.authFailed(id);
        this._pendingAuths.delete(id);
        throw error;
      }
    })();

    this._pendingAuths.set(id, result); // It's now pending.
    return result;
  }

  /**
   * Gets a proxy for the target with the given ID or which is controlled by the
   * given key. This will create the proxy if it did not previously exist. This
   * method does _not_ check to see if the far side of the connection knows
   * about the so-identified target (or if it does, whether it allows access to
   * it without further authorization).
   *
   * @param {string|BaseKey} idOrKey ID or key for the target.
   * @returns {Proxy} Proxy which locally represents the so-identified
   *   server-side target.
   */
  getProxy(idOrKey) {
    const id = (idOrKey instanceof BaseKey)
      ? idOrKey.id
      : TString.check(idOrKey);

    return this._targets.addOrGet(id);
  }

  /**
   * Indicates whether or not this instance is the one that handles the given
   * presumed-proxy. This returns `true` if the given `obj` is a `Proxy` that
   * was returned by a call to {@link #getProxy} on this instance, _and_ it was
   * not subsequently removed.
   *
   * @param {object} obj The presumed-proxy in question.
   * @returns {boolean} `true` if `obj` is a proxy handled by this instance, or
   *   `false` if not.
   */
  handles(obj) {
    return this._targets.handles(obj);
  }

  /**
   * Indicates whether or not this instance believes its connection is
   * sufficiently open, such that it is possible to send messages. This method
   * returns `true` if the instance is in the middle of opening (and is
   * enqueuing messages) or is fully open and actively exchanging messages with
   * a server.
   *
   * @returns {boolean} `true` iff this instance is open, per above.
   */
  isOpen() {
    return this._connection.isOpen();
  }

  /**
   * Opens the connection, if not already open. Once open, any pending messages
   * will get sent to the server side. If the connection is already open (or in
   * the process of opening), this does not re-open it; that is, the existing
   * act of opening is allowed to continue.
   *
   * As an `async` method, this returns once the connection has been opened.
   *
   * @throws {ConnectionError} Indication of why the connection attempt failed.
   */
  async open() {
    await this._connection.open();

    this.log.event.opening();

    const id = await this.meta.connectionId();

    this.connectionId = id;
    this.log.event.open();
  }

  /**
   * Handles a `close` event coming from a websocket. This logs the closure and
   * terminates all active messages by rejecting their promises.
   *
   * @param {object} event Event that caused this callback.
   */
  _handleClose(event) {
    this.log.info('Closed:', event);

    const code = WebsocketCodes.close(event.code);
    const desc = event.reason ? `${code}: ${event.reason}` : code;
    const error = ConnectionError.connectionClosed(this._connectionId, desc);

    this._handleTermination(event, error);
  }

  /**
   * Handles an `error` event coming from a websocket. This behaves similarly
   * to the `close` event.
   *
   * **Note:** Because errors in this case are typically due to transient
   * connection issues (e.g. network went away) and not due to fundamental
   * system issues, this is logged as `info` and not `error` (or `warn`).
   *
   * @param {object} event Event that caused this callback.
   */
  _handleError(event) {
    this.log.info('Error:', event);

    // **Note:** The error event does not have any particularly useful extra
    // info, so -- alas -- there is nothing to get out of it for the
    // `ConnectionError` description.
    const error = ConnectionError.connectionError(this._connectionId);
    this._handleTermination(event, error);
  }

  /**
   * Handles a `message` event coming from a websocket. In this case, messages
   * are expected to be the responses from previously-sent messages (e.g.
   * method calls), encoded as JSON. The `id` of the response is used to look up
   * the callback function in `this._callbacks`. That callback is then called in
   * a separate turn.
   *
   * @param {object} event Event that caused this callback.
   */
  _handleMessage(event) {
    this.log.detail('Received raw data:', event.data);

    const response = this._codec.decodeJson(event.data);

    if (!(response instanceof Response)) {
      throw ConnectionError.connectionNonsense(this._connectionId, 'Got strange response.');
    }

    const { id, result, error } = response;

    const callback = this._callbacks[id];
    if (callback) {
      delete this._callbacks[id];
      if (error) {
        // **Note:** `error` is always an instance of `CodableError`.
        this.log.detail(`Reject ${id}:`, error);
        // What's going on here is that we use the information from the original
        // error as the outer error payload, and include a `cause` that
        // unambiguously indicates that the origin is remote. This arrangement
        // means that clients can handle well-defined errors fairly
        // transparently and straightforwardly (e.g. and notably, they don't
        // have to "unwrap" the errors in the usual case), while still being
        // able to ascertain the foreign origin of the errors when warranted.
        const remoteCause = CodableError.remoteError(this.connectionId);
        const rejectReason = new CodableError(remoteCause, error.info);
        callback.reject(rejectReason);
      } else {
        this.log.detail(`Resolve ${id}:`, result);
        if (result instanceof Remote) {
          // The result is a proxied object, not a regular value.
          callback.resolve(this._targets.addOrGet(result.targetId));
        } else {
          callback.resolve(result);
        }
      }
    } else {
      // See above about `server_bug`.
      throw ConnectionError.connectionNonsense(this._connectionId, `Orphan call for ID ${id}.`);
    }
  }


  /**
   * Common code to handle both `error` and `close` events.
   *
   * @param {object} event_unused Event that caused this callback.
   * @param {ConnectionError} error Reason for termination. "Error" is a bit of
   *   a misnomer, as in many cases termination is a-okay.
   */
  _handleTermination(event_unused, error) {
    // Reject the promises of any currently-pending messages.
    for (const id in this._callbacks) {
      const { message, reject } = this._callbacks[id];

      this._log.event.rejectDuringTermination(...message.deconstruct());
      reject(error);
    }

    // Clear the state related to the websocket. It is safe to re-open the
    // connection after this.
    this._resetConnection();
  }

  /**
   * Sends the given call to the server.
   *
   * **Note:** This method is called via a `TargetHandler` instance, which is
   * in turn called by a proxy object representing an object on the far side of
   * the connection.
   *
   * @param {string} target Name of the target object.
   * @param {Functor} payload The name of the method to call and the arguments
   *   to call it with.
   * @returns {Promise} Promise for the result (or error) of the call. In the
   *   case of an error, the rejection reason will always be an instance of
   *   `ConnectionError` (see which for details).
   */
  async _send(target, payload) {
    const id = this._nextId;
    this._nextId++;

    const message = new Message(id, target, payload);
    const msgJson = this._codec.encodeJson(message);

    this.log.info('Sending:', message);

    await this._connection.send(msgJson);

    this.log.info('Queued:', message);

    return new Promise((resolve, reject) => {
      this._callbacks[id] = { message, resolve, reject };
    });
  }
}
