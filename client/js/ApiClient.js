// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import JsonUtil from 'json-util';
import SeeAll from 'see-all';
import WebsocketCodes from 'websocket-codes';

import ApiError from './ApiError';

/** Logger. */
const log = new SeeAll('api');

/** Value used for an unknown connection ID. */
const UNKNOWN_CONNECTION_ID = 'id-unknown';

/**
 * Connection with the server, via a websocket.
 */
export default class ApiClient {
  /**
   * Constructs an instance. `url` should represent the origin as an `http` or
   * `https` URL. This instance will connect to a websocket at the same domain
   * at the path `/api`. Once this constructor returns, it is safe to call any
   * API methods on the instance; if the socket isn't yet ready for traffic,
   * the calls will get enqueued and then replayed in order once the socket
   * becomes ready.
   */
  constructor(url) {
    url = new URL(url);

    // Convert the URL scheme to either `ws` or `wss`, corresponding to `http`
    // or `https`.
    url.protocol = url.protocol.replace(/^http/, 'ws');

    // Drop the original path, and replace it with just `/api`.
    url.pathname = '/api';

    // Clear out any post-path bits.
    url.search = '';
    url.hash = '';

    /** URL for the websocket server. */
    this._url = url.href;

    /**
     * Connection ID conveyed to us by the server. Reset in
     * `_resetConnection()`.
     */
    this._connectionId = null;

    /**
     * Actual websocket instance. Set by `open()`. Reset in
     * `_resetConnection()`.
     */
    this._ws = null;

    /**
     * Next message ID to use when sending a message. Initialized and reset in
     * `_resetConnection()`.
     */
    this._nextId = 0;

    /**
     * Map from message IDs to response callbacks. Each callback is an object
     * that maps `resolve` and `reject` to functions that obey the usual
     * promise contract for functions of those names. Initialized and reset in
     * `_resetConnection()`.
     */
    this._callbacks = null;

    /**
     * List of pending calls. Only used when connection is in the middle of
     * being established. Initialized and reset in `_resetConnection()`.
     */
    this._pendingCalls = null;

    // Initialize the active connection fields (described above).
    this._resetConnection();
  }

  /**
   * Init or reset the state having to do with an active connection. See the
   * constructor for documentation about these fields.
   */
  _resetConnection() {
    this._ws           = null;
    this._connectionId = UNKNOWN_CONNECTION_ID;
    this._nextId       = 0;
    this._callbacks    = {};
    this._pendingCalls = [];
  }

  /**
   * Sends the given call to the server. Returns a promise for the result
   * (or error). In the case of an error, the rejection reason will always be an
   * instance of `ApiError` (see which for details).
   */
  _send(method, args) {
    const wsState = this._ws.readyState;

    // Handle the cases where socket shutdown is imminent or has already
    // happened. We don't just `throw` directly here, so that clients can
    // consistently handle errors via one of the promise chaining mechanisms.
    switch (wsState) {
      case WebSocket.CLOSED: {
        return Promise.reject(
          ApiError.connError('closed', `${this._connectionId}: closed`));
      }
      case WebSocket.CLOSING: {
        return Promise.reject(
          ApiError.connError('closing', `${this._connectionId}: closing`));
      }
    }

    const id = this._nextId;
    const payloadObj = {method: method, args: args, id: id};
    const payload = JSON.stringify(payloadObj);

    let callback;
    const result = new Promise((resolve, reject) => {
      callback = {resolve: resolve, reject: reject};
    });

    this._callbacks[id] = callback;
    this._nextId++;

    switch (wsState) {
      case WebSocket.CONNECTING: {
        // Not yet open. Need to queue it up.
        this._pendingCalls.push(payload);
        break;
      }
      case WebSocket.OPEN: {
        this._ws.send(payload);
        break;
      }
      default: {
        // Whatever this state is, it's not documented as part of the Websocket
        // spec!
        log.wtf(`${this._connectionId} in weird state: ${wsState}`);
      }
    }

    log.detail(`${this._connectionId} sent:`, payloadObj);

    return result;
  }

  /**
   * Common code to handle both `error` and `close` events.
   */
  _handleTermination(event, error) {
    // Reject the promises of any currently-pending calls.
    for (let id in this._callbacks) {
      this._callbacks[id].reject(error);
    }

    // Clear the state related to the websocket. It is safe to re-open the
    // connection after this.
    this._resetConnection();
  }

  /**
   * Handles a `close` event coming from a websocket. This logs the closure and
   * terminates all active calls by rejecting their promises.
   */
  _handleClose(event) {
    log.info(`${this._connectionId} closed:`, event);

    const code = WebsocketCodes.close(event.code);
    const reason = event.reason || 'Websocket closed.';
    const error = ApiError.connError(code, reason);

    this._handleTermination(event, error);
  }

  /**
   * Handles an `error` event coming from a websocket. This behaves similarly
   * to the `close` event.
   *
   * **Note:** Because errors in this case are typically due to transient
   * connection issues (e.g. network went away) and not due to fundamental
   * system issues, this is logged as `info` and not `error` (or `warn`).
   */
  _handleError(event) {
    log.info(`${this._connectionId} error:`, event);

    // **Note:** The error event does not have any particularly useful extra
    // info, so -- alas -- there is nothing to get out of it for the `ApiError`
    // description.
    const error = ApiError.connError('error', `${this._connectionId} error`);
    this._handleTermination(event, error);
  }

  /**
   * Handles an `open` event coming from a websocket. In this case, it sends
   * any pending calls (calls that were made while the socket was still in the
   * process of opening).
   */
  _handleOpen(event) {
    for (let payload of this._pendingCalls) {
      this._ws.send(payload);
    }
    this._pendingCalls = [];
  }

  /**
   * Handles a `message` event coming from a websocket. In this case, messages
   * are expected to be the responses from previous calls, encoded as JSON. The
   * `id` of the response is used to look up the callback function in
   * `this._callbacks`. That callback is then called in a separate tick.
   */
  _handleMessage(event) {
    const payload = JsonUtil.parseFrozen(event.data);
    const id = payload.id;
    let result = payload.result;
    const error = payload.error;

    if (result === undefined) {
      result = null;
    }

    if (typeof id !== 'number') {
      // We handle these as a `server_bug` and not, e.g. logging as `wtf()` and
      // aborting, because this is indicative of a server-side problem and not
      // an unrecoverable local problem.
      if (!id) {
        throw ApiError.connError('server_bug',
          `${this._connectionId}: Missing ID on API response.`);
      } else {
        throw ApiError.connError('server_bug',
          `${this._connectionId}: Strange ID type \`${typeof id}\` on API response.`);
      }
    }

    const callback = this._callbacks[id];
    if (callback) {
      delete this._callbacks[id];
      if (error) {
        log.detail(`${this._connectionId} reject ${id}:`, error);
        callback.reject(ApiError.appError('app_error', error));
      } else {
        log.detail(`${this._connectionId} resolve ${id}:`, result);
        callback.resolve(result);
      }
    } else {
      // See above about `server_bug`.
      throw ApiError.connError('server_bug', `${this._connectionId}: Orphan call for ID ${id}.`);
    }
  }

  /**
   * Opens the websocket. Once open, any pending calls will get sent to the
   * server side. Returns a promise for the result of opening; this will resolve
   * as a `true` success or fail with an `ApiError`.
   */
  open() {
    if (this._ws !== null) {
      return Promise.reject(
        ApiError.connError('client_bug', `${this._connectionId}: Already open`));
    }

    const url = this._url;
    this._ws = new WebSocket(url);
    this._ws.onclose   = this._handleClose.bind(this);
    this._ws.onerror   = this._handleError.bind(this);
    this._ws.onmessage = this._handleMessage.bind(this);
    this._ws.onopen    = this._handleOpen.bind(this);

    return this.connectionId().then((value) => {
      this._connectionId = value;
      log.info(`${this._connectionId}: open`);
      return true;
    });
  }

  /**
   * The connection ID if known, or a reasonably suggestive string if not.
   * This class automatically sets this when connections get made, so that
   * clients don't generally have to make an API call to get this info.
   */
  get id() {
    return this._connectionId;
  }

  /**
   * API call `ping`. No-op request that verifies an active connection.
   */
  ping() {
    return this._send('ping', {});
  }

  /**
   * API call `connectionId`. Requests the connection ID to use for logging.
   */
  connectionId() {
    return this._send('connectionId', {});
  }

  /**
   * API call `snapshot`. Requests a document snapshot. Returns a promise for
   * the result.
   */
  snapshot() {
    return this._send('snapshot', {});
  }

  /**
   * API call `deltaAfter`. Requests a delta for a newer version with respect
   * to a given version.
   */
  deltaAfter(baseVerNum) {
    return this._send('deltaAfter', {baseVerNum: baseVerNum});
  }

  /**
   * API call `applyDelta`. Sends a change to the server in the form of a
   * base version number and delta therefrom. Returns a promise for the
   * result, which is an object consisting of a new version number, and a
   * delta which can be applied to the version corresponding to `baseVerNum`
   * to get the new version.
   */
  applyDelta(baseVerNum, delta) {
    return this._send('applyDelta', {baseVerNum: baseVerNum, delta: delta});
  }
};
