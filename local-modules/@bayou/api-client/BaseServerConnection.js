// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CodableError, ConnectionError, Message, Remote, Response } from '@bayou/api-common';
import { EventSource } from '@bayou/prom-util';
import { Logger } from '@bayou/see-all';
import { TString } from '@bayou/typecheck';
import { CommonBase, Functor, WebsocketCodes } from '@bayou/util-common';

/** {string} Value used for an unknown connection ID. */
const UNKNOWN_CONNECTION_ID = 'id_unknown';

/** {string} Event name to use for messages (either sent or received). */
const EVENT_MESSAGE = 'message';

/** {Logger} Logger. */
const log = new Logger('api-conn');

/**
 * Base class which abstracts away details of a connection to a server. This
 * class provides a promise-chained sequence of events representing received
 * messages, along with an interface for queuing up / sending messages to the
 * far side of the connection.
 *
 * **Note:** At this layer, messages are all strings. **TODO:** They should be
 * binary (arrays of bytes) instead.
 */
export default class BaseServerConnection extends CommonBase {
  /**
   * Constructs an instance. Once constructed, it is valid to send messages
   * via the instance; should the connection not be fully established, any
   * sent messages are queued up and will be sent in-order once the
   * connection is ready.
   */
  constructor() {
    super();

    /**
     * {string} Connection ID conveyed to us by the server. Reset in
     * {@link #_resetConnection()}.
     */
    this._connectionId = UNKNOWN_CONNECTION_ID;

    /**
     * {Logger} Logger which prefixes everything with the connection ID (if
     * available). Set in {@link #_updateLogger}, which is called whenever
     * {@link #_connectionId} is updated.
     */
    this._log = log;

    /**
     * {EventSource} Emitter used for the events representing messages received
     * by this instance from the far side of the connection.
     */
    this._receivedSource = new EventSource();

    /**
     * {EventSource} Emitter used for the events representing messages sent by
     * this instance to the far side of the connection.
     */
    this._sentSource = new EventSource();
  }

  /**
   * {string} The connection ID if known, or a reasonably suggestive string if
   * not. The client of this instance is responsible for setting this. If set
   * to `null`, it will instead become aforementioned "reasonably suggestive"
   * string.
   */
  get connectionId() {
    return this._connectionId;
  }

  set connectionId(id) {
    this._connectionId = (id === null)
      ? UNKNOWN_CONNECTION_ID
      : TString.nonEmpty(id);

    this._updateLogger();
  }

  /**
   * {Logger} The client-specific logger.
   */
  get log() {
    return this._log;
  }

  /**
   * Queues up a message to send to the far side of the connection. If the
   * connection is active, the message will in fact be sent shortly after this
   * method completes.
   *
   * @param {string} message Message to send.
   */
  send(message) {
    TString.check(message);
    this._sentSource.emit(new Functor(EVENT_MESSAGE, message));
  }

  /**
   * Opens the websocket. Once open, any pending messages will get sent to the
   * server side. If the socket is already open (or in the process of opening),
   * this does not re-open (that is, the existing open is allowed to continue).
   *
   * As an `async` method, this returns once the connection has been opened.
   *
   * @throws {ConnectionError} Indication of why the connection attempt failed.
   */
  async open() {
    // If `_ws` is `null` that means that the connection is not already open or
    // in the process of opening.

    if (this._connectionId !== UNKNOWN_CONNECTION_ID) {
      // Already open.
      return;
    } else if (this._ws !== null) {
      // In the middle of getting opened. Arguably this should do something a
      // bit more efficient (instead of issuing a separate API call), but also
      // this shouldn't ever happen, so it's not that big a deal.
      this._log.info('open() called while in the middle of opening.');
      await this.meta.ping();
      return;
    }

    this._ws = new WebSocket(this._websocketUrl);
    this._ws.onclose   = this._handleClose.bind(this);
    this._ws.onerror   = this._handleError.bind(this);
    this._ws.onmessage = this._handleMessage.bind(this);
    this._ws.onopen    = this._handleOpen.bind(this);

    this._updateLogger();
    this._log.event.opening();

    const id = await this.meta.connectionId();

    this._connectionId = id;
    this._updateLogger();
    this._log.event.open();
  }

  /**
   * Handles a `close` event coming from a websocket. This logs the closure and
   * terminates all active messages by rejecting their promises.
   *
   * @param {object} event Event that caused this callback.
   */
  _handleClose(event) {
    this._log.info('Closed:', event);

    const code = WebsocketCodes.close(event.code);
    const desc = event.reason ? `${code}: ${event.reason}` : code;
    const error = ConnectionError.connection_closed(this._connectionId, desc);

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
    this._log.info('Error:', event);

    // **Note:** The error event does not have any particularly useful extra
    // info, so -- alas -- there is nothing to get out of it for the
    // `ConnectionError` description.
    const error = ConnectionError.connection_error(this._connectionId);
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

    const response = this._codec.decodeJson(event.data);

    if (!(response instanceof Response)) {
      throw ConnectionError.connection_nonsense(this._connectionId, 'Got strange response.');
    }

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
        const remoteCause = new CodableError('remote_error', this.connectionId);
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
      // See above about `server_bug`.
      throw ConnectionError.connection_nonsense(this._connectionId, `Orphan call for ID ${id}.`);
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
      this._callbacks[id].reject(error);
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
   * @param {string} target Name of the target object.
   * @param {Functor} payload The name of the method to call and the arguments
   *   to call it with.
   * @returns {Promise} Promise for the result (or error) of the call. In the
   *   case of an error, the rejection reason will always be an instance of
   *   `ConnectionError` (see which for details).
   */
  _send(target, payload) {
    const wsState = (this._ws === null)
      ? WebSocket.CLOSED
      : this._ws.readyState;

    // Handle the cases where socket shutdown is imminent or has already
    // happened. We don't just `throw` directly here, so that clients can
    // consistently handle errors via one of the promise chaining mechanisms.
    switch (wsState) {
      case WebSocket.CLOSED: {
        // The detail string here differentiates this case from cases where the
        // API message was already queued up or sent before the websocket became
        // closed.
        return Promise.reject(ConnectionError.connection_closed(this._connectionId, 'Already closed.'));
      }
      case WebSocket.CLOSING: {
        return Promise.reject(this.connection_closing(this._connectionId));
      }
    }

    const id = this._nextId;
    this._nextId++;

    const msg     = new Message(id, target, payload);
    const msgJson = this._codec.encodeJson(msg);

    switch (wsState) {
      case WebSocket.CONNECTING: {
        // Not yet open. Need to queue it up.
        this._log.detail('Queued:', msg);
        this._pendingMessages.push(msgJson);
        break;
      }
      case WebSocket.OPEN: {
        this._log.detail('Sent:', msg);
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
      this._callbacks[id] = { resolve, reject };
    });
  }

  /**
   * Updates {@link #_log} based on {@link #_connectionId}.
   */
  _updateLogger() {
    const id = (this._connectionId === UNKNOWN_CONNECTION_ID)
      ? 'unknown'
      : this._connectionId;

    this._log = log.withAddedContext(id);
  }
}
