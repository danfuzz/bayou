// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Hooks } from 'hooks-server';
import { WebsocketCodes } from 'util-common';

import Connection from './Connection';

/**
 * Direct handler for API requests over a websocket connection.
 */
export default class WsConnection extends Connection {
  /**
   * Constructs an instance. As a side effect, the contructor attaches the
   * constructed instance to the websocket (as an event listener).
   *
   * @param {WebSocket} ws A websocket instance corresponding to the connection.
   * @param {object} req The HTTP request.
   * @param {Context} context The binding context to provide access to.
   */
  constructor(ws, req, context) {
    super(context, Hooks.theOne.baseUrlFromRequest(req));

    /** {WebSocket} The websocket for the client connection. */
    this._ws = ws;

    ws.on('message', this._handleMessage.bind(this));
    ws.on('close', this._handleClose.bind(this));
    ws.on('error', this._handleError.bind(this));
  }

  /**
   * Handles a `message` event coming from the underlying websocket. Calls on
   * the superclass (see which) for processing.
   *
   * @param {string} msg Incoming message, in JSON string form.
   */
  _handleMessage(msg) {
    this.handleJsonMessage(msg).then((response) => {
      this._ws.send(response);
    });
  }

  /**
   * Handles a `close` event coming from the underlying websocket.
   *
   * @param {number} code The reason code for why the socket was closed.
   * @param {string} msg The human-oriented description for the reason.
   */
  _handleClose(code, msg) {
    const codeStr = WebsocketCodes.close(code);
    const msgStr = msg ? `: ${msg}` : '';

    this._log.info(`Close: ${codeStr}${msgStr}`);
    this.close();
  }

  /**
   * Handles an `error` event coming from the underlying websocket.
   *
   * @param {object} error The error event.
   */
  _handleError(error) {
    this._log.info('Error:', error);
    this.close();
  }
}
