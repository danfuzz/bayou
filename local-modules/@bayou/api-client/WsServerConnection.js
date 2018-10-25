// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ConnectionError, Message } from '@bayou/api-common';
import { WebsocketCodes } from '@bayou/util-common';

import BaseServerConnection from './BaseServerConnection';

/**
 * Server connection handler which uses a websocket to communicate with a
 * server, using the standard URI endpoint `/api`.
 */
export default class WsServerConnection extends BaseServerConnection {
  /**
   * Constructs an instance. This instance will connect to a websocket at the
   * same domain as the given `url`, at the path `/api`. Once this constructor
   * returns, it is safe to send messages on the instance; if the socket isn't
   * yet ready for traffic, the messages will get enqueued and then later
   * replayed in-order once the socket becomes ready.
   *
   * @param {string} url The server origin, as an `http` or `https` URL.
   */
  constructor(url) {
    super();

    /** {string} Base URL for the server. */
    this._baseUrl = WsServerConnection._getBaseUrl(url);

    /** {string} URL to use when connecting a websocket. */
    this._wsUrl = WsServerConnection._getWsUrl(this._baseUrl);

    /** {WebSocket|null} Actual websocket instance. */
    this._ws = null;

    Object.seal(this);
  }

  /** {string} Base URL for the remote endpoint this client gets attached to. */
  get baseUrl() {
    return this._baseUrl;
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
      // bit more efficient (instead of issuing a separate API call), but also
      // this shouldn't ever happen, so it's not that big a deal.
      this.log.info('open() called while in the middle of opening.');
      await this.meta.ping();
      return true;
    }

    this._ws = new WebSocket(this._websocketUrl);
    this._ws.onclose   = this._handleClose.bind(this);
    this._ws.onerror   = this._handleError.bind(this);
    this._ws.onmessage = this._handleMessage.bind(this);
    this._ws.onopen    = this._handleOpen.bind(this);

    this._updateLogger();
    this.log.event.opening();

    const id = await this.meta.connectionId();

    this._connectionId = id;
    this._updateLogger();
    this.log.event.open();

    return true;
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
    this.log.info('Error:', event);

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
    this.log.info('Received raw data:', event.data);
    this.received(event.data);
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
      this.log.detail('Sent from queue:', msgJson);
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
    this._ws = null;
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
        return Promise.reject(ConnectionError.connection_closing(this._connectionId));
      }
    }

    const id = this._nextId;
    this._nextId++;

    const msg     = new Message(id, target, payload);
    const msgJson = this._codec.encodeJson(msg);

    switch (wsState) {
      case WebSocket.CONNECTING: {
        // Not yet open. Need to queue it up.
        this.log.detail('Queued:', msg);
        this._pendingMessages.push(msgJson);
        break;
      }
      case WebSocket.OPEN: {
        this.log.detail('Sent:', msg);
        this._ws.send(msgJson);
        break;
      }
      default: {
        // Whatever this state is, it's not documented as part of the websocket
        // spec!
        this.log.wtf('Weird state:', wsState);
      }
    }

    return new Promise((resolve, reject) => {
      this._callbacks[id] = { resolve, reject };
    });
  }

  /**
   * Gets the base URL for the given original URL.
   *
   * @param {string} origUrl The original URL.
   * @returns {string} The corresponding base URL.
   */
  static _getBaseUrl(origUrl) {
    return new URL(origUrl).origin;
  }

  /**
   * Gets the websocket URL corresponding to the given base URL.
   *
   * @param {string} baseUrl The base URL.
   * @returns {string} The corresponding websocket URL.
   */
  static _getWsUrl(baseUrl) {
    const url = new URL(baseUrl);

    // Convert the URL scheme to either `ws` or `wss`, corresponding to `http`
    // or `https`.
    url.protocol = url.protocol.replace(/^http/, 'ws');

    // Drop the original path, and replace it with just `/api`.
    url.pathname = '/api';

    return url.href;
  }
}
