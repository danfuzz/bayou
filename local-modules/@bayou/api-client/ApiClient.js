// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CodableError, ConnectionError, Message, Remote, Response } from '@bayou/api-common';
import { Codec } from '@bayou/codec';
import { Logger } from '@bayou/see-all';
import { TString } from '@bayou/typecheck';
import { CommonBase, WebsocketCodes } from '@bayou/util-common';

import { TargetMap } from './TargetMap';

/** Logger. */
const log = new Logger('api');

/** Value used for an unknown connection ID. */
const UNKNOWN_CONNECTION_ID = 'id_unknown';

/**
 * Connection with the server, via a websocket.
 */
export class ApiClient extends CommonBase {
  /**
   * Constructs an instance. This instance will connect to a websocket at the
   * given URL (that is, it is expected to name the API endpoint). Once this
   * constructor returns, it is safe to call any API methods on the instance's
   * associated `target`. If the socket isn't yet ready for traffic, the
   * messages will get enqueued and then replayed in order once the socket
   * becomes ready.
   *
   * @param {string} apiUrl The server endpoint, as an `http` or `https` URL.
   *   This endpoint is expected to respond using the API protocol as defined
   *   in this and the other `api-*` modules.
   * @param {Codec} codec Codec instance to use. In order to function properly,
   *   its registry must include all of the encodable classes defined in
   *   `@bayou/api-common` classes. See
   *   {@link @bayou/api-common.Codecs.registerCodecs}.
   */
  constructor(apiUrl, codec) {
    super();

    /** {string} The server endpoint, as an `http` or `https` URL. */
    this._serverUrl = TString.urlAbsolute(apiUrl);

    /** {Codec} Codec instance to use. */
    this._codec = Codec.check(codec);

    /**
     * {string|null} Connection ID conveyed to us by the server. Reset in
     * {@link #_resetConnection}.
     */
    this._connectionId = null;

    /**
     * {Logger} Logger which prefixes everything with the connection ID (if
     * available). Set in {@link #_updateLogger}, which is called whenever
     * {@link #_connectionId} is updated.
     */
    this._log = log;

    /**
     * {WebSocket} Actual websocket instance. Set by {@link #open}. Reset in
     * {@link #_resetConnection}.
     */
    this._ws = null;

    /**
     * {Int} Next message ID to use when sending a message. Initialized and
     * reset in `_resetConnection()`.
     */
    this._nextId = 0;

    /**
     * {object<Int, {message, resolve, reject}>} Map from message IDs to
     * response callbacks and original message info (the latter for debugging).
     * Each element is an object that maps `resolve` and `reject` to functions
     * that obey the usual promise contract for functions of those names, and
     * `message` to the originally-sent {@link Message}. Initialized and reset
     * in {@link #_resetConnection}.
     */
    this._callbacks = null;

    /**
     * {array<string>} List of pending messages (to be sent to the far side of
     * the connection). Only used when connection is in the middle of being
     * established. Initialized and reset in {@link #_resetConnection}.
     */
    this._pendingMessages = null;

    /**
     * {boolean} Whether the server is trying to get this connection closed.
     */
    this._serverClosing = false;

    /**
     * {TargetMap} Map of names/IDs to target proxies. See {@link
     * TargetMap#constructor} for details about the argument.
     */
    this._targets = new TargetMap(this._send.bind(this));

    // Initialize the active connection fields (described above).
    this._resetConnection();

    this._log.event.constructed(apiUrl);

    Object.seal(this);
  }

  /**
   * {string} The connection ID if known, or a reasonably suggestive string if
   * not. This class automatically sets the ID when connections get made, so
   * that clients don't generally have to make an API call to get this info.
   */
  get connectionId() {
    return this._connectionId;
  }

  /**
   * {Logger} The client-specific logger.
   */
  get log() {
    return this._log;
  }

  /**
   * {Proxy} The object upon which meta-API calls can be made.
   */
  get meta() {
    return this._targets.get('meta');
  }

  /**
   * Gets a proxy for the target with the given ID or which is controlled by the
   * given token. This will create the proxy if it did not previously exist.
   * This method does _not_ check to see if the far side of the connection knows
   * about the so-identified target (or if it does, whether it allows access to
   * it without further authorization).
   *
   * @param {string|BearerToken} idOrToken ID or token for the target.
   * @returns {Proxy} Proxy which locally represents the so-identified
   *   server-side target.
   */
  getProxy(idOrToken) {
    return this._targets.addOrGet(idOrToken);
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
   * Indicates whether or not this instance is connected to `localhost`. This is
   * mostly of use during testing.
   *
   * @returns {boolean} `true` iff this instance's server is running locally.
   */
  isLocal() {
    const hostname = new URL(this._serverUrl).hostname;

    return hostname === 'localhost';
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
    if (this._ws === null) {
      return false;
    }

    const readyState = this._ws.readyState;

    return (readyState === WebSocket.CONNECTING) || (readyState === WebSocket.OPEN);
  }

  /**
   * Opens the websocket. Once open, any pending messages will get sent to the
   * server side. If the socket is already open (or in the process of opening),
   * this does not re-open (that is, the existing open is allowed to continue).
   *
   * @returns {boolean} `true` once the connection is open.
   * @throws {ConnectionError} Indication of why the connection attempt failed.
   */
  async open() {
    // If `_ws` is `null` that means that the connection is not already open or
    // in the process of opening.

    if (this._connectionId !== UNKNOWN_CONNECTION_ID) {
      // Already open.
      return true;
    } else if (this._ws !== null) {
      // In the middle of getting opened. Arguably this should do something a
      // bit more efficient (instead of issuing a separate API call).
      this._log.event.concurrentOpen();
      await this.meta.ping();
      return true;
    }

    this._ws = new WebSocket(this._websocketUrl);
    this._ws.onclose   = this._handleClose.bind(this);
    this._ws.onerror   = this._handleError.bind(this);
    this._ws.onmessage = this._handleMessage.bind(this);
    this._ws.onopen    = this._handleOpen.bind(this);

    this._updateLogger();
    this._log.event.opening();

    try {
      const [id, serverInfo] = await Promise.all([
        this.meta.connectionId(),
        this.meta.serverInfo()]);

      this._connectionId = id;
      this._updateLogger();
      this._log.event.open(serverInfo);
    } catch (e) {
      this._log.event.errorDuringOpen(e);
      throw e;
    }

    return true;
  }

  /** {Int} The websocket state. */
  get _websocketState() {
    if (this._ws === null) {
      return WebSocket.CLOSED;
    } else if (this._serverClosing) {
      return WebSocket.CLOSING;
    } else {
      return this._ws.readyState;
    }
  }

  /** {string} The websocket URL for this instance. */
  get _websocketUrl() {
    const url = new URL(this._serverUrl);

    // Convert the URL scheme to either `ws` or `wss`, corresponding to `http`
    // or `https`.
    url.protocol = url.protocol.replace(/^http/, 'ws');

    return url.href;
  }

  /**
   * Handles an incoming API protocol {@link Message} object. The client only
   * ever expects one possible target ID and message, namely `meta.close()`,
   * which the server will send when it wants to close the connection.
   *
   * @param {Message} message The message.
   */
  _handleApiMessage(message) {
    const { targetId, payload } = message;

    // Check to see if it's the one message we recognize. If not, there's
    // nothing to do other than log the weirdness. (E.g., if we throw, it'll
    // end up in the void anyway.)
    if ((targetId !== 'meta') || (payload.name !== 'close')) {
      this._log.event.weirdMessage(message);
      return;
    }

    if (!this._serverClosing) {
      this._log.event.serverIsClosing();
      this._serverClosing = true;
    }
  }

  /**
   * Handles an incoming API protocol {@link Response} object.
   *
   * @param {Response} response The response.
   */
  _handleApiResponse(response) {
    const { id, result, error } = response;

    const callback = this._callbacks[id];
    if (callback) {
      delete this._callbacks[id];
      if (error) {
        // **Note:** `error` is always an instance of `CodableError`.
        this._log.detail(`Reject ${id}:`, error);
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
        this._log.detail(`Resolve ${id}:`, result);
        if (result instanceof Remote) {
          // The result is a proxied object, not a regular value.
          callback.resolve(this._targets.addOrGet(result.targetId));
        } else {
          callback.resolve(result);
        }
      }
    } else {
      // There's nothing to catch an exception if we threw one here, so just log
      // the weirdness.
      this._log.event.orphanResponse(response);
    }
  }

  /**
   * Handles a `close` event coming from a websocket. This logs the closure and
   * terminates all active messages by rejecting their promises.
   *
   * @param {object} event Event that caused this callback.
   */
  _handleClose(event) {
    this._log.event.closed(event);

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
    this._log.event.websocketError(event);

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
    this._log.detail('Received raw data:', event.data);

    const obj = this._codec.decodeJson(event.data);

    if (obj instanceof Response) {
      this._handleApiResponse(obj);
    } else if (obj instanceof Message) {
      this._handleApiMessage(obj);
    } else {
      // There's nothing to catch an exception if we threw one here, so just log
      // the weirdness.
      this._log.event.weirdMessage(obj);
    }
  }

  /**
   * Handles an `open` event coming from a websocket. In this case, it sends
   * any pending messages (that were enqueued while the socket was still in the
   * process of opening).
   *
   * @param {object} event_unused Event that caused this callback.
   */
  _handleOpen(event_unused) {
    for (const msgJson of this._pendingMessages) {
      this._log.detail('Sent from queue:', msgJson);
      this._ws.send(msgJson);
    }
    this._pendingMessages = [];
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

      this._log.event.rejectDuringTermination(message.logInfo);
      reject(error);
    }

    // Clear the state related to the websocket. It is safe to re-open the
    // connection after this.
    this._resetConnection();
  }

  /**
   * Initializes or resets the state having to do with an active connection. See
   * the constructor for documentation about these fields.
   */
  _resetConnection() {
    this._ws              = null;
    this._connectionId    = UNKNOWN_CONNECTION_ID;
    this._nextId          = 0;
    this._callbacks       = {};
    this._pendingMessages = [];
    this._targets.clear();
    this._targets.add('meta'); // The one guaranteed target.

    this._updateLogger();
  }

  /**
   * Sends the given call to the server.
   *
   * **Note:** This method is called via a `TargetHandler` instance, which is
   * in turn called by a proxy object representing an object on the far side of
   * the connection.
   *
   * @param {string|BearerToken} idOrTarget ID or token which identifies the
   *   target object on the other side of the API connection.
   * @param {Functor} payload The name of the method to call and the arguments
   *   to call it with.
   * @returns {*} Result or error returned by the remote call. In the case of an
   *   error, the rejection reason will always be an instance of
   *   {@link ConnectionError} (see which for details).
   */
  async _send(idOrTarget, payload) {
    const wsState = this._websocketState;

    // Handle the cases where socket shutdown is imminent or has already
    // happened.
    switch (wsState) {
      case WebSocket.CLOSED: {
        // The detail string here differentiates this case from cases where the
        // API message was already queued up or sent before the websocket became
        // closed.
        throw ConnectionError.connectionClosed(this._connectionId, 'Already closed.');
      }
      case WebSocket.CLOSING: {
        throw ConnectionError.connectionClosing(this._connectionId);
      }
    }

    if (this._targets.getOrNull(idOrTarget) === null) {
      // `idOrTarget` isn't in the map of same; that is it's totally unknown.
      // Most likely indicates a bug in a higher layer of the system.
      throw ConnectionError.unknownTarget(this._connectionId, idOrTarget);
    }

    const id = this._nextId;
    this._nextId++;

    const message = new Message(id, idOrTarget, payload);
    const msgJson = this._codec.encodeJson(message);

    switch (wsState) {
      case WebSocket.CONNECTING: {
        // Not yet open. Need to queue it up.
        this._log.detail('Queued:', message);
        this._pendingMessages.push(msgJson);
        break;
      }
      case WebSocket.OPEN: {
        this._log.detail('Sent:', message);
        this._ws.send(msgJson);
        break;
      }
      default: {
        // Whatever this state is, it's not documented as part of the websocket
        // spec!
        this._log.wtf('Weird state:', wsState);
      }
    }

    return new Promise((resolve, reject) => {
      this._callbacks[id] = { message, resolve, reject };
    });
  }

  /**
   * Updates {@link #_log} based on {@link #_connectionId}.
   */
  _updateLogger() {
    let id = this._connectionId;

    if ((id === null) || (id === UNKNOWN_CONNECTION_ID)) {
      id = (this._ws === null) ? 'unconnected' : 'connecting';
    }

    this._log = log.withAddedContext(id);
  }
}
