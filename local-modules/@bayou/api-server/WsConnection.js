// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import WebSocket from 'ws';

import { WebsocketCodes } from '@bayou/util-common';

import BaseConnection from './BaseConnection';

/**
 * Direct handler for API requests over a websocket connection.
 */
export default class WsConnection extends BaseConnection {
  /**
   * Constructs an instance. As a side effect, the contructor attaches the
   * constructed instance to the websocket (as an event listener).
   *
   * @param {WebSocket} ws A websocket instance corresponding to the connection.
   * @param {object} req The HTTP request.
   * @param {ContextInfo} contextInfo Construction info for the {@link Context}
   *   to use.
   */
  constructor(ws, req, contextInfo) {
    super(contextInfo);

    this._log.event.websocketOrigin(req.headers.origin);

    /** {WebSocket} The websocket for the client connection. */
    this._ws = ws;

    ws.on('message', this._handleMessage.bind(this));
    ws.on('close', this._handleClose.bind(this));
    ws.on('error', this._handleError.bind(this));
  }

  /**
   * Implementation of method as required by the superclass.
   *
   * @returns {boolean} `true` if the connection is open, or `false` if not.
   */
  _impl_isOpen() {
    const readyState = this._ws.readyState;

    return (readyState === WebSocket.CONNECTING) || (readyState === WebSocket.OPEN);
  }

  /**
   * Handles a `close` event coming from the underlying websocket.
   *
   * @param {number} code The reason code for why the socket was closed.
   * @param {string} msg The human-oriented description for the reason.
   */
  _handleClose(code, msg) {
    const codeStr = WebsocketCodes.close(code);
    const msgArgs = msg ? ['/', msg] : [];

    this._log.event.websocketClose(codeStr, ...msgArgs);
    this.close();
  }

  /**
   * Handles an `error` event coming from the underlying websocket.
   *
   * @param {object} error The error event.
   */
  _handleError(error) {
    this._log.event.websocketError(error);
    this.close();
  }

  /**
   * Handles a `message` event coming from the underlying websocket. Calls on
   * the superclass (see which) for processing.
   *
   * @param {string} msg Incoming message, in JSON string form.
   */
  async _handleMessage(msg) {
    try {
      const response = await this.handleJsonMessage(msg);
      this._ws.send(response);
    } catch (e) {
      this._handleError(e);
    }
  }
}
