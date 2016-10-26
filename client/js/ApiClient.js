// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

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
    this.url = url.href;

    /** Actual websocket instance. Set by `open()`. */
    this.ws = null;

    /** Next message ID to use when sending a message. */
    this.nextId = 0;

    /**
     * Map from message IDs to response callbacks. Each callback is an object
     * that maps `resolve` and `reject` to functions that obey the usual
     * promise contract for functions of those names.
     */
    this.callbacks = {};

    /**
     * List of pending calls. Only used when connection is in the middle of
     * being established.
     */
    this.pendingCalls = [];
  }

  /**
   * Sends the given call to the server. Returns a promise for the result
   * (or error).
   */
  _send(method, args) {
    const wsState = this.ws.readyState;

    // Handle the cases where socket shutdown is imminent or has already
    // happened. We don't just `throw` directly here, so that clients can
    // consistently handle errors via one of the promise chaining mechanisms.
    switch (wsState) {
      case WebSocket.CLOSED: {
        return Promise.reject(new Error('Websocket is closed.'));
      }
      case WebSocket.CLOSING: {
        return Promise.reject(new Error('Websocket is closing.'));
      }
    }

    const id = this.nextId;
    const payload = JSON.stringify({ method: method, args: args, id: id });

    let callback;
    const result = new Promise((resolve, reject) => {
      callback = { resolve: resolve, reject: reject };
    });

    this.callbacks[id] = callback;
    this.nextId++;

    switch (wsState) {
      case WebSocket.CONNECTING: {
        // Not yet open. Need to queue it up.
        this.pendingCalls.push(payload);
        break;
      }
      case WebSocket.OPEN: {
        this.ws.send(payload);
        break;
      }
      default: {
        // Whatever this state is, it's not documented as part of the Websocket
        // spec!
        return Promise.reject(new Error(`Websocket in weird state: ${wsState}`));
      }
    }

    console.log(`Websocket sent: ${payload}`);

    return result;
  }

  /**
   * Handles the `open` event coming from a websocket. In this case, it sends
   * any pending calls (calls that were made while the socket was still in the
   * process of opening).
   */
  _handleOpen(event) {
    for (let payload of this.pendingCalls) {
      this.ws.send(payload);
    }
    this.pendingCalls = [];
  }

  /**
   * Handles a `message` event coming from a websocket. In this case, messages
   * are expected to be the responses from previous calls, encoded as JSON. The
   * `id` of the response is used to look up the callback function in
   * `this.callbacks`. That callback is then called in a separate tick.
   */
  _handleMessage(event) {
    const payload = JSON.parse(event.data);
    const id = payload.id;
    let result = payload.result;
    const error = payload.error;

    if (result === undefined) {
      result = null;
    }

    if (typeof id !== 'number') {
      if (!id) {
        throw new Error('Missing ID on API response.');
      } else {
        throw new Error(`Strange ID type \`${typeof id}\` on API response.`);
      }
    }

    const callback = this.callbacks[id];
    if (callback) {
      delete this.callbacks[id];
      if (error) {
        console.log(`Websocket reject ${id}: ${JSON.stringify(error)}`);
        callback.reject(new Error(error));
      } else {
        console.log(`Websocket resolve ${id}: ${JSON.stringify(result)}`);
        callback.resolve(result);
      }
    } else {
      throw new Error(`Orphan call for ID ${id}.`);
    }
  }

  /**
   * Opens the websocket. Once open, any pending calls will get sent to the
   * server side. Doesn't return a value.
   */
  open() {
    if (this.ws !== null) {
      throw new Error('Already open');
    }

    const url = this.url;
    this.ws = new WebSocket(url);
    this.ws.onmessage = this._handleMessage.bind(this);
    this.ws.onopen    = this._handleOpen.bind(this);
  }

  /**
   * API call `snapshot`. Requests a document snapshot. Returns a promise for
   * the result.
   */
  snapshot() {
    return this._send('snapshot', { });
  }

  /**
   * API call `deltaAfter`. Requests a delta for a newer version with respect
   * to a given version.
   */
  deltaAfter(baseVersion) {
    return this._send('deltaAfter', { baseVersion: baseVersion });
  }

  /**
   * API call `applyDelta`. Sends a change to the server in the form of a
   * base version number and delta therefrom. Returns a promise for the
   * result, which is an object consisting of a new version number, and a
   * delta which can be applied to the version corresponding to `baseVersion`
   * to get the new version.
   */
  applyDelta(baseVersion, delta) {
    return this._send('applyDelta', { baseVersion: baseVersion, delta: delta });
  }
};
