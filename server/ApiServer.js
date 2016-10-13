// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import util from 'util';

import log from './log';

export default class ApiServer {
  /**
   * Constructs an instance. Each instance corresponds to a separate client
   * connection. `ws` is a websocket instance corresponding to that connection.
   * As a side effect, the contructor attaches the constructed instance to the
   * websocket.
   */
  constructor(ws) {
    this.ws = ws;
    ws.on('message', this._handleMessage.bind(this));
    ws.on('close', this._handleClose.bind(this));
    ws.on('error', this._handleError.bind(this));
  }

  /**
   * Handles a `message` event coming from the underlying websocket.
   */
  _handleMessage(msg) {
    log('Websocket message:');
    msg = JSON.parse(msg);
    log(msg);

    var method = msg.method;
    var impl;
    if (method === undefined) {
      impl = this.error_missing_method;
    } else if (typeof method !== 'string') {
      impl = this.error_bad_method;
    } else {
      impl = this[`method_${method}`];
      if (!impl) {
        impl = this.error_unknown_method;
      }
    }

    var response = { ok: false, id: msg.id };
    try {
      let result = impl.call(this, msg.args);
      if (result !== undefined) {
        response.result = result;
      }
      response.ok = true;
    } catch (e) {
      response.error = e.message;
    }

    log('Websocket response:');
    log(response);
    this.ws.send(JSON.stringify(response));
  }

  /**
   * Handles a `close` event coming from the underlying websocket.
   */
  _handleClose(code, msg) {
    log('Websocket close:');
    log(code);
    log(msg);
  }

  /**
   * Handles an `error` event coming from the underlying websocket.
   */
  _handleError(err) {
    log('Websocket error:');
    log(err);
  }

  /**
   * API error: Bad value for `method` in call payload (not a string).
   */
  error_bad_method(args) {
    throw new Error('bad_method');
  }

  /**
   * API error: Missing `method` in call payload.
   */
  error_missing_method(args) {
    throw new Error('missing_method');
  }

  /**
   * API error: Unknown (undefined) method.
   */
  error_unknown_method(args) {
    throw new Error('unknown_method');
  }

  /**
   * API method `test`: Responds back with the same arguments as it was passed.
   */
  method_test(args) {
    return args;
  }

  /**
   * API method `update`: Accepts a document update from the client.
   */
  method_update(args) {
    // TODO: Something real.
    log('Delta');
    log(util.inspect(args.delta));
  }
}
