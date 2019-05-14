// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import WebSocket from 'ws';

import { Message } from '@bayou/api-common';
import { Condition } from '@bayou/promise-util';
import { Functor, WebsocketCodes } from '@bayou/util-common';

import { HttpConnection } from './HttpConnection';

/**
 * {Int} Number of messages that are proactively rejected while in the process
 * of closing a connection. See long comment in {@link #_handleMessage} for
 * details.
 */
const MAX_MESSAGES_WHILE_CLOSING = 100;

/**
 * Direct handler for API requests over a websocket connection.
 */
export class WsConnection extends HttpConnection {
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
    super(req, contextInfo);

    this._log.event.websocketOrigin(req.headers.origin);

    /** {WebSocket} The websocket for the client connection. */
    this._ws = ws;

    /**
     * {Condition} Condition that becomes `true` when a `close` or `error`
     * event has been received from {@link #_ws}.
     */
    this._wsCloseCondition = new Condition();

    /**
     * {Int} Count of messages that have been allowed through during the act of
     * closing the connection. See long comment in {@link #_handleMessage} for
     * details.
     */
    this._messagesWhileClosing = 0;

    /**
     * {Int} Count of messages that have been received and are in the middle of
     * being acted upon.
     */
    this._pendingMessageCount = 0;

    /**
     * {Condition} Condition that becomes `true` whenever
     * {@link #_pendingMessageCount} is `0`.
     */
    this._pendingZeroCondition = new Condition(true);

    ws.on('message', this._handleMessage.bind(this));
    ws.on('close', this._handleClose.bind(this));
    ws.on('error', this._handleError.bind(this));

    Object.seal(this);
  }

  /**
   * Implementation of method as required by the superclass.
   */
  async _impl_close() {
    try {
      // Send a message to the client telling them what's up. If they're nice,
      // they'll handle it promptly instead of, say, continuing to try to send
      // messages.
      this._ws.send(this.context.encodeMessage(new Message(0, 'meta', new Functor('close'))));
    } catch (e) {
      // Ignore exceptions. It's probably that the websocket is already closed
      // (common case when we end up here from the client proactively closing),
      // and in any case we don't really care about failure to send because
      // we're trying to get the socket to be closed anyway!
    }

    // Wait for the in-flight messsages to be handled.
    await this._pendingZeroCondition.whenTrue();

    // Tell the websocket to close, and wait for it to actually be closed.
    this._ws.close(1000);
    await this._wsCloseCondition.whenTrue();
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
  async _handleClose(code, msg) {
    const codeStr = WebsocketCodes.close(code);
    const msgArgs = msg ? ['/', msg] : [];

    this._log.event.websocketClose(codeStr, ...msgArgs);
    this._wsCloseCondition.value = true;
    await this.close();
  }

  /**
   * Handles an `error` event coming from the underlying websocket.
   *
   * @param {object} error The error event.
   */
  async _handleError(error) {
    this._log.event.websocketError(error);
    this._wsCloseCondition.value = true;

    await this.close();
  }

  /**
   * Handles a `message` event coming from the underlying websocket. Calls on
   * the superclass (see which) for processing.
   *
   * @param {string} msg Incoming message, in JSON string form.
   */
  async _handleMessage(msg) {
    if (this.isClosing()) {
      // The connection has been asked to close. We let a handful of messages go
      // through, which the superclass will promptly reject with an error, and
      // then we just ignore any further incoming messages. This arrangement
      // lets the client know fairly promptly that the connection is going away
      // (as opposed to, say, going silent, because it is often the case that
      // the thing that is keeping the connection open is a long-poll-type
      // request which may take a while to time out, and we don't want to just
      // silently fail to act on data change requests), while also not allowing
      // a client to be such a bad actor that it keeps the connection from
      // getting shut down by keeping it filled with messages that get queued up
      // for a response (terse though the response may be). In any case, once
      // any in-flight messages are handled, the connection will get closed for
      // realsies, and any messages left hanging will get rejected (error
      // thrown) on the calling side.
      this._messagesWhileClosing++;
      if (this._messagesWhileClosing > MAX_MESSAGES_WHILE_CLOSING) {
        return;
      }
    }

    try {
      this._pendingMessageCount++;
      this._pendingZeroCondition.value = false;

      const response = await this.handleJsonMessage(msg);

      this._ws.send(response);
    } catch (e) {
      this._handleError(e);
    } finally {
      this._pendingMessageCount--;
      this._pendingZeroCondition.value = (this._pendingMessageCount === 0);
    }
  }
}
