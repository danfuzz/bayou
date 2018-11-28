// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Condition } from '@bayou/promise-util';
import { TString } from '@bayou/typecheck';
import { WebsocketCodes } from '@bayou/util-common';

import BaseServerConnection from './BaseServerConnection';

/**
 * Server connection handler which uses a websocket to communicate with a
 * server, using the standard URI endpoint `/api`.
 *
 * **TODO:** This class is an as-yet nonfunctional work-in-progress. See the
 * header comment in {@link ApiClient} for more details.
 */
export default class WsServerConnection extends BaseServerConnection {
  /**
   * Constructs an instance. This instance will connect to a websocket at the
   * same domain as the given `url`, at the path `/api`. Once this constructor
   * returns, it is safe to send messages on the instance; if the socket isn't
   * yet ready for traffic, the messages will get enqueued and then later
   * replayed in-order once the socket becomes ready.
   *
   * @param {string} serverUrl The server origin, as an `http` or `https` URL.
   */
  constructor(serverUrl) {
    super();

    /** {string} The server endpoint, as an `http` or `https` URL. */
    this._serverUrl = TString.urlAbsolute(serverUrl);

    /** {string} URL to use when connecting a websocket. */
    this._websocketUrl = WsServerConnection._getWebsocketUrl(this._serverUrl);

    /** {WebSocket|null} Actual websocket instance. */
    this._ws = null;

    /**
     * {Condition} Condition variable that becomes instantaneously `true` with
     * every state change to {@link #_ws}.
     */
    this._wsStateChange = new Condition();

    this.log.event.constructed(serverUrl);

    Object.seal(this);
  }

  /**
   * Implementation as required by the superclass.
   *
   * @abstract
   */
  async _impl_beReceiving() {
    await this._ensureOpen();
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {string} message The message to send.
   */
  async _impl_sendMessage(message) {
    // We do this as a loop (not just an `if`), because it's possible for the
    // connection to close between the time that `_ensureOpen()` returns and
    // when control returns to this code from the `await`. Should this instance
    // decide to "give up" it will do so by throwing an error from
    // `_ensureOpen()`, thus breaking out of the loop.
    while ((this._ws === null) || (this._ws.readyState !== WebSocket.OPEN)) {
      await this._ensureOpen();
    }

    // **TODO:** Consider the case where the underlying networking system hasn't
    // had a chance to service `_ws` and so there is a large amount of buffered
    // data. The spec allows `send()` to throw in this case, and if it does it
    // will also close the socket. We would rather hold off and give the
    // networking system time to drain the buffer. The `WebSocket` property
    // `bufferedAmount` can be used to see how much has been buffered, but
    // unfortunately there is no way to know how much is "too much," so that
    // will have to be determined more heuristically.
    this._ws.send(message);
  }

  /**
   * Ensure that the websocket is open and receptive to sending and receiving
   * messages. This will be the case at the time that this method returns. Due
   * to the `async` nature of the method (and the system), though, it could
   * possbily become _not_ the case by the time the call site regains control.
   * Therefore, callers must verify the state of the socket _synchronously_
   * before attempting to send or receive messages.
   */
  async _ensureOpen() {
    for (;;) {
      if (this._ws === null) {
        // No active socket. Create (and start to open) it.
        this._ws           = new WebSocket(this._websocketUrl);
        this._ws.onclose   = this._handleClose.bind(this);
        this._ws.onerror   = this._handleError.bind(this);
        this._ws.onmessage = this._handleMessage.bind(this);
        this._ws.onopen    = this._handleOpen.bind(this);

        this._updateLogger();
        this.log.event.websocketState('opening');
      }

      switch (this._ws.readyState) {
        case WebSocket.CLOSED: {
          // Clear out `_ws` and iterate to retry.
          this.log.event.websocketState('closed');
          this._ws.onclose   = null;
          this._ws.onerror   = null;
          this._ws.onmessage = null;
          this._ws.onopen    = null;
          this._ws           = null;
          break;
        }

        case WebSocket.CLOSING: {
          // Wait for it to be closed.
          this.log.event.websocketState('closing');
          await this._wsStateChange.whenTrue();
          break;
        }

        case WebSocket.CONNECTING: {
          // Wait for it to be open (or fail to connect).
          this.log.event.websocketState('connecting');
          await this._wsStateChange.whenTrue();
          break;
        }

        case WebSocket.OPEN: {
          // What we've wanted all along!
          this.log.event.websocketState('open');
          break;
        }
      }
    }
  }

  /**
   * Handles a `close` event coming from a websocket.
   *
   * @param {object} event Event that caused this callback.
   */
  _handleClose(event) {
    const code = WebsocketCodes.close(event.code);
    const desc = event.reason ? `${code}: ${event.reason}` : code;

    this.log.event.websocketClose(event, desc);
    this._wsStateChange.onOff(); // Intercom with `_ensureOpen()`.
  }

  /**
   * Handles an `error` event coming from a websocket. This behaves similarly
   * to the `close` event.
   *
   * @param {object} event Event that caused this callback.
   */
  _handleError(event) {
    // **Note:** The error event does not have any particularly useful extra
    // info, so -- alas -- there is nothing to get out of it as a "description"
    // (or similar).
    this.log.event.websocketError(event);

    this._wsStateChange.onOff(); // Intercom with `_ensureOpen()`.
  }

  /**
   * Handles a `message` event coming from a websocket.
   *
   * @param {object} event Event that caused this callback.
   */
  _handleMessage(event) {
    this.log.event.rawMessage(event.data);
    this.received(event.data);
  }

  /**
   * Handles an `open` event coming from a websocket.
   *
   * @param {object} event Event that caused this callback.
   */
  _handleOpen(event) {
    // **Note:** The open event does not have any particularly useful extra
    // info, so -- alas -- there is nothing to get out of it as a "description"
    // (or similar).
    this.log.event.websocketOpen(event);
    this._wsStateChange.onOff(); // Intercom with `_ensureOpen()`.
  }

  /**
   * Gets the websocket URL corresponding to the given base URL.
   *
   * @param {string} baseUrl The base URL.
   * @returns {string} The corresponding websocket URL.
   */
  static _getWebsocketUrl(baseUrl) {
    const url = new URL(baseUrl);

    // Convert the URL scheme to either `ws` or `wss`, corresponding to `http`
    // or `https`.
    url.protocol = url.protocol.replace(/^http/, 'ws');

    // Drop the original path, and replace it with just `/api`. **TODO:** We
    // should instead assume that the path is valid, instead of forcing one
    // particular value.
    url.pathname = '/api';

    return url.href;
  }
}
