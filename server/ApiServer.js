// Copyright 2016 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import util from 'util';

import RandomId from 'random-id';
import SeeAll from 'see-all';
import WebsocketCodes from 'websocket-codes';

/** Logger. */
const log = new SeeAll('api');

export default class ApiServer {
  /**
   * Constructs an instance. Each instance corresponds to a separate client
   * connection. As a side effect, the contructor attaches the constructed
   * instance to the websocket.
   *
   * @param ws A websocket instance corresponding to that connection.
   * @param doc The document to interact with.
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

    ws.on('message', this._handleMessage.bind(this));
    ws.on('close', this._handleClose.bind(this));
    ws.on('error', this._handleError.bind(this));

    log.info(`${this._connectionId} open.`);
  }

  /**
   * Handles a `message` event coming from the underlying websocket. For valid
   * methods, this calls the method implementation and handles both the case
   * where the result is a simple value or a promise.
   */
  _handleMessage(msg) {
    this._messageCount++;
    if ((this._messageCount % 25) === 0) {
      log.info(`${this._connectionId} handled ${this._messageCount} messages.`);
    }

    msg = JSON.parse(msg);
    log.detail(`${this._connectionId} message:`, msg);

    const method = msg.method;
    let impl;
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

    // Function to send a response. Arrow syntax so that `this` is usable.
    const respond = (result, error) => {
      let response = {id: msg.id};
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
    }

    try {
      // Note: If the method implementation returns a non-promise, then the
      // `resolve()` call operates promptly.
      Promise.resolve(impl.call(this, msg.args)).then(
        (result) => { respond(result, null); },
        (error) => { respond(null, error); });
    } catch (error) {
      respond(null, error);
    }
  }

  /**
   * Handles a `close` event coming from the underlying websocket.
   */
  _handleClose(code, msg) {
    const codeStr = WebsocketCodes.close(code);
    const msgStr = msg ? `: ${msg}` : '';
    log.info(`${this._connectionId} ${codeStr}${msgStr}`);
  }

  /**
   * Handles an `error` event coming from the underlying websocket.
   */
  _handleError(error) {
    log.info(`${this._connectionId} error:`, error);
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
   * API method `ping`: No-op method that merely verifies (implicitly) that the
   * connection is working. Always returns `true`.
   */
  method_ping(args) {
    return true;
  }

  /**
   * API method `connectionId`: Returns the connection ID that the server
   * assigned to this connection. This is only meant to be used for logging.
   * For example, it is _not_ guaranteed to be unique.
   */
  method_connectionId(args) {
    return this._connectionId;
  }

  /**
   * API method `snapshot`: Returns an instantaneous snapshot of the document
   * contents. Result is an object that maps `data` to the snapshot data and
   * `version` to the version number.
   */
  method_snapshot(args) {
    return this._doc.snapshot();
  }

  /**
   * API method `applyDelta`: Takes a base version number and delta therefrom,
   * and applies the delta, including merging of any intermediate versions.
   * Result is an object consisting of a new version number, and a
   * delta which can be applied to version `baseVersion` to get the new
   * document.
   */
  method_applyDelta(args) {
    return this._doc.applyDelta(args.baseVersion, args.delta);
  }

  /**
   * API method `deltaAfter`: Returns a promise for a snapshot of any version
   * after the given `baseVersion`, and relative to that version. Result is an
   * object consisting of a new version number, and a delta which can be applied
   * to version `baseVersion` to get the new document. If called when
   * `baseVersion` is the current version, this will not fulfill the result
   * promise until at least one change has been made.
   */
  method_deltaAfter(args) {
    return this._doc.deltaAfter(args.baseVersion);
  }
}
