// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import JsonUtil from 'json-util';
import RandomId from 'random-id';
import SeeAll from 'see-all';
import Typecheck from 'typecheck';
import WebsocketCodes from 'websocket-codes';

import MetaHandler from './MetaHandler';

/** Logger. */
const log = new SeeAll('api');

/**
 * Direct handler for API requests. This is responsible for interpreting
 * and responding to incoming websocket data. It mostly bottoms out by calling
 * on a document object.
 */
export default class ApiServer {
  /**
   * Constructs an instance. Each instance corresponds to a separate client
   * connection. As a side effect, the contructor attaches the constructed
   * instance to the websocket.
   *
   * @param {WebSocket} ws A websocket instance corresponding to the connection.
   * @param {DocServer} doc The document to interact with.
   */
  constructor(ws, doc) {
    /** The Websocket for the client connection. */
    this._ws = ws;

    /** The document being managed. */
    this._doc = doc;

    /** Short ID string used to identify this connection in logs. */
    this._connectionId = RandomId.make('conn');

    /** Count of messages received. Used for liveness logging. */
    this._messageCount = 0;

    /** The object to handle meta-requests. */
    this._meta = new MetaHandler(this._doc, this._connectionId);

    ws.on('message', this._handleMessage.bind(this));
    ws.on('close', this._handleClose.bind(this));
    ws.on('error', this._handleError.bind(this));

    log.info(`${this._connectionId} open.`);
  }

  /**
   * Handles a `message` event coming from the underlying websocket. For valid
   * methods, this calls the method implementation and handles both the case
   * where the result is a simple value or a promise.
   *
   * @param {string} msg Incoming message, in JSON string form.
   */
  _handleMessage(msg) {
    this._messageCount++;
    if ((this._messageCount % 25) === 0) {
      log.info(`${this._connectionId} handled ${this._messageCount} messages.`);
    }

    msg = JsonUtil.parseFrozen(msg);
    log.detail(`${this._connectionId} message:`, msg);

    let target     = this._doc;
    let schemaPart = 'methods';
    let methodImpl = null;

    try {
      Typecheck.objectWithExactKeys(msg, ['id', 'action', 'name', 'args']);
      Typecheck.intMin(msg.id, 0);
      Typecheck.string(msg.action);
      Typecheck.string(msg.name);
      Typecheck.array(msg.args);

      if (msg.action === 'meta') {
        // The `meta` action gets treated as a `call` on the meta-handler.
        target     = this._meta;
        schemaPart = 'meta';
      }
    } catch (e) {
      target = this;
      methodImpl = this.error_bad_message;
      // Remake the message such that it can ultimately be dispatched (to
      // produce the desired error response).
      msg = {
        id:     -1,
        action: 'error',
        name:   'unknown-name',
        args:   [msg]
      };
    }

    switch (msg.action) {
      case 'error': {
        // Nothing extra to do. We'll fall through and dispatch to the error
        // implementation which was already set up.
        break;
      }

      case 'call':
      case 'meta': {
        const name = msg.name;
        const allowedMethods = this._meta.schema()[schemaPart];
        if (allowedMethods[name]) {
          // Listed in the schema. So it exists, is public, is in fact bound to
          // a function, etc.
          methodImpl = target[name];
        }
        break;
      }

      default: {
        target = this;
        methodImpl = this.error_bad_action;
        break;
      }
    }

    if (methodImpl === null) {
      target = this;
      methodImpl = this.error_unknown_method;
    }

    // Function to send a response. Arrow syntax so that `this` is usable.
    const respond = (result, error) => {
      const response = {id: msg.id};
      if (error) {
        response.ok = false;
        response.error = error.message;
      } else {
        response.ok = true;
        response.result = result;
      }

      log.detail(`${this._connectionId} response:`, response);
      if (error) {
        log.detail(`${this._connectionId} error:`, error);
      }
      this._ws.send(JSON.stringify(response));
    };

    try {
      // Note: If the method implementation returns a non-promise, then the
      // `resolve()` call operates promptly.
      Promise.resolve(methodImpl.apply(target, msg.args)).then(
        (result) => { respond(result, null); },
        (error) => { respond(null, error); });
    } catch (error) {
      respond(null, error);
    }
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
    log.info(`${this._connectionId} ${codeStr}${msgStr}`);
  }

  /**
   * Handles an `error` event coming from the underlying websocket.
   *
   * @param {object} error The error event.
   */
  _handleError(error) {
    log.info(`${this._connectionId} error:`, error);
  }

  /**
   * API error: Bad value for `message` in call payload (invalid shape).
   *
   * @param {object} msg_unused The original message.
   */
  error_bad_message(msg_unused) {
    throw new Error('bad_message');
  }

  /**
   * API error: Bad value for `action` in call payload (not a recognized value).
   *
   * @param {object} msg_unused The original message.
   */
  error_bad_action(msg_unused) {
    throw new Error('bad_action');
  }

  /**
   * API error: Unknown (undefined) method.
   *
   * @param {object} msg_unused The original message.
   */
  error_unknown_method(msg_unused) {
    throw new Error('unknown_method');
  }
}
