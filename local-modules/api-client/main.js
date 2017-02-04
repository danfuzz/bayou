// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import JsonUtil from 'json-util';
import SeeAll from 'see-all';
import WebsocketCodes from 'websocket-codes';

import ApiError from './ApiError';
import TargetMap from './TargetMap';

/** Logger. */
const log = new SeeAll('api');

/** Value used for an unknown connection ID. */
const UNKNOWN_CONNECTION_ID = 'id-unknown';

/**
 * Connection with the server, via a websocket.
 */
export default class ApiClient {
  /** Export of helper class. */
  static get ApiError() {
    return ApiError;
  }

  /**
   * Constructs an instance. This instance will connect to a websocket at the
   * same domain at the path `/api`. Once this constructor returns, it is safe
   * to call any API methods on the instance's associated `target`. If the
   * socket isn't yet ready for traffic, the calls will get enqueued and then
   * replayed in order once the socket becomes ready.
   *
   * @param {string} url The server origin, as an `http` or `https` URL.
   */
  constructor(url) {
    /** URL for the websocket server. */
    this._url = ApiClient._getWebsocketUrl(url);

    /**
     * Connection ID conveyed to us by the server. Set / reset in
     * `_resetConnection()`.
     */
    this._connectionId = null;

    /** Logger which prefixes everything with the connection ID. */
    this._log = log.withDynamicPrefix(() => [`[${this._connectionId}]`]);

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

    /** Map of names to target proxies. */
    this._targets = new TargetMap(this);

    // Initialize the active connection fields (described above).
    this._resetConnection();
  }

  /**
   * Gets the websocket URL for the given original (base) URL.
   *
   * @param {string} origUrl The original (base) URL.
   * @returns {string} The corresponding websocket URL.
   */
  static _getWebsocketUrl(origUrl) {
    const url = new URL(origUrl);

    // Convert the URL scheme to either `ws` or `wss`, corresponding to `http`
    // or `https`.
    url.protocol = url.protocol.replace(/^http/, 'ws');

    // Drop the original path, and replace it with just `/api`.
    url.pathname = '/api';

    // Clear out any post-path bits.
    url.search = '';
    url.hash = '';

    return url.href;
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
   * Constructs an `ApiError` representing a connection error and including
   * the current connection ID in the description.
   *
   * @param {string} code Short error code.
   * @param {string} desc Longer-form description.
   * @returns {ApiError} An appropriately-constructed instance.
   */
  _connError(code, desc) {
    return ApiError.connError(code, `[${this._connectionId}] ${desc}`);
  }

  /**
   * Sends the given call to the server.
   *
   * @param {string} target Name of the target object.
   * @param {string} action Action to invoke.
   * @param {string} name Name of method (or meta-method) to call on the server.
   * @param {object} [args = []] JSON-encodable object of arguments.
   * @returns {Promise} Promise for the result (or error) of the call. In the
   *   case of an error, the rejection reason will always be an instance of
   *   `ApiError` (see which for details).
   */
  _send(target, action, name, args = []) {
    const wsState = this._ws.readyState;

    // Handle the cases where socket shutdown is imminent or has already
    // happened. We don't just `throw` directly here, so that clients can
    // consistently handle errors via one of the promise chaining mechanisms.
    switch (wsState) {
      case WebSocket.CLOSED: {
        return Promise.reject(this._connError('closed', 'Closed.'));
      }
      case WebSocket.CLOSING: {
        return Promise.reject(this._connError('closing', 'Closing.'));
      }
    }

    const id = this._nextId;
    const payloadObj = {id, target, action, name, args};
    const payload = JSON.stringify(payloadObj);

    let callback;
    const result = new Promise((resolve, reject) => {
      callback = {resolve, reject};
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
        this._log.wtf(`Weird state: ${wsState}`);
      }
    }

    this._log.detail('Sent:', payloadObj);

    return result;
  }

  /**
   * Common code to handle both `error` and `close` events.
   *
   * @param {object} event_unused Event that caused this callback.
   * @param {ApiError} error Reason for termination. "Error" is a bit of a
   *   misnomer, as in many cases termination is a-okay.
   */
  _handleTermination(event_unused, error) {
    // Reject the promises of any currently-pending calls.
    for (const id in this._callbacks) {
      this._callbacks[id].reject(error);
    }

    // Clear the state related to the websocket. It is safe to re-open the
    // connection after this.
    this._resetConnection();
  }

  /**
   * Handles a `close` event coming from a websocket. This logs the closure and
   * terminates all active calls by rejecting their promises.
   *
   * @param {object} event Event that caused this callback.
   */
  _handleClose(event) {
    this._log.info('Closed:', event);

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
   *
   * @param {object} event Event that caused this callback.
   */
  _handleError(event) {
    this._log.info('Error:', event);

    // **Note:** The error event does not have any particularly useful extra
    // info, so -- alas -- there is nothing to get out of it for the `ApiError`
    // description.
    const error = this._connError('error', 'Unknown error.');
    this._handleTermination(event, error);
  }

  /**
   * Handles an `open` event coming from a websocket. In this case, it sends
   * any pending calls (calls that were made while the socket was still in the
   * process of opening).
   *
   * @param {object} event_unused Event that caused this callback.
   */
  _handleOpen(event_unused) {
    for (const payload of this._pendingCalls) {
      this._ws.send(payload);
    }
    this._pendingCalls = [];
  }

  /**
   * Handles a `message` event coming from a websocket. In this case, messages
   * are expected to be the responses from previous calls, encoded as JSON. The
   * `id` of the response is used to look up the callback function in
   * `this._callbacks`. That callback is then called in a separate tick.
   *
   * @param {object} event Event that caused this callback.
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
        throw this._connError('server_bug', 'Missing ID on API response.');
      } else {
        throw this._connError('server_bug',
          `Strange ID type \`${typeof id}\` on API response.`);
      }
    }

    const callback = this._callbacks[id];
    if (callback) {
      delete this._callbacks[id];
      if (error) {
        this._log.detail(`Reject ${id}:`, error);
        callback.reject(ApiError.appError('app_error', error));
      } else {
        this._log.detail(`Resolve ${id}:`, result);
        callback.resolve(result);
      }
    } else {
      // See above about `server_bug`.
      throw this._connError('server_bug', `Orphan call for ID ${id}.`);
    }
  }

  /**
   * Opens the websocket. Once open, any pending calls will get sent to the
   * server side.
   *
   * @returns {Promise} A promise for the result of opening. This will resolve
   * as a `true` success or fail with an `ApiError`.
   */
  open() {
    if (this._ws !== null) {
      return Promise.reject(this._connError('client_bug', 'Already open.'));
    }

    const url = this._url;
    this._ws = new WebSocket(url);
    this._ws.onclose   = this._handleClose.bind(this);
    this._ws.onerror   = this._handleError.bind(this);
    this._ws.onmessage = this._handleMessage.bind(this);
    this._ws.onopen    = this._handleOpen.bind(this);

    return this.meta.connectionId().then((value) => {
      this._connectionId = value;
      this._log.info('Open.');
      return true;
    });
  }

  /**
   * The connection ID if known, or a reasonably suggestive string if not.
   * This class automatically sets the ID when connections get made, so that
   * clients don't generally have to make an API call to get this info.
   */
  get connectionId() {
    return this._connectionId;
  }

  /**
   * The main object upon which API calls can be made.
   */
  get main() {
    return this._targets.get('main');
  }

  /**
   * The object upon which meta-API calls can be made.
   */
  get meta() {
    return this._targets.get('meta');
  }
}
