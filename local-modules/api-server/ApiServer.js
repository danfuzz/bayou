// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Decoder, Encoder } from 'api-common';
import { SeeAll } from 'see-all';
import { TArray, TInt, TObject, TString } from 'typecheck';
import { RandomId, WebsocketCodes } from 'util-common';

import MetaHandler from './MetaHandler';
import Target from './Target';

/** Logger. */
const log = new SeeAll('api');

/**
 * Direct handler for API requests. This is responsible for interpreting
 * and responding to incoming websocket data. It mostly bottoms out by calling
 * on a target object, which performs the actual services. That is, this class
 * is plumbing.
 */
export default class ApiServer {
  /**
   * Constructs an instance. Each instance corresponds to a separate client
   * connection. As a side effect, the contructor attaches the constructed
   * instance to the websocket (as an event listener).
   *
   * @param {WebSocket} ws A websocket instance corresponding to the connection.
   * @param {object} target The target to provide access to.
   */
  constructor(ws, target) {
    /** The Websocket for the client connection. */
    this._ws = ws;

    /** Short ID string used to identify this connection in logs. */
    this._connectionId = RandomId.make('conn');

    /**
     * {Map<string,Schema>} Schemas for each target object (see `_targets`,
     * below), initialized lazily.
     */
    this._schemas = new Map();

    /**
     * The targets to provide access to. `main` is the object providing the main
     * functionality, and `meta` provides meta-information and meta-control.
     * **Note:** We can only fill in `meta` after this instance variable is
     * otherwise fully set up, since the `MetaHandler` constructor will end up
     * accessing it. (Whee!)
     */
    this._targets = new Map();
    this._addTarget(new Target('main', target));
    this._addTarget(new Target('meta', new MetaHandler(this)));

    /** Count of messages received. Used for liveness logging. */
    this._messageCount = 0;

    /** Logger which includes the connection ID as a prefix. */
    this._log = log.withPrefix(`[${this._connectionId}]`);

    ws.on('message', this._handleMessage.bind(this));
    ws.on('close', this._handleClose.bind(this));
    ws.on('error', this._handleError.bind(this));

    this._log.info('Open.');
  }

  /**
   * Adds a target to the set thereof.
   *
   * @param {Target} target Target to add.
   */
  _addTarget(target) {
    this._targets.set(target.name, target);
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
      this._log.info(`Handled ${this._messageCount} messages.`);
    }

    msg = this._decodeMessage(msg); // Not supposed to ever throw.

    // Function to send a response. Arrow syntax so that `this` is usable.
    const respond = (result, error) => {
      const response = {id: msg.id};
      if (error) {
        response.error = error.message;
      } else {
        response.result = result;
      }

      this._log.detail('Response:', response);
      if (error) {
        // TODO: Ultimately _some_ errors coming back from API calls shouldn't
        // be considered log-worthy server errors. We will need to differentiate
        // them at some point.
        this._log.error('Error:', error);
      }
      this._ws.send(Encoder.encodeJson(response));
    };

    if (msg.error) {
      respond(null, msg.error);
    } else {
      try {
        this._actOnMessage(msg, respond);
      } catch (e) {
        respond(null, e);
      }
    }
  }

  /**
   * Helper for `_handleMessage()` which parses the original incoming message.
   * In case of error, this will return an object that binds `error` to an
   * appropriate exception; and in this case, `id` will be defined to be either
   * the successfully parsed message ID or `-1` if parsing couldn't even make it
   * that far. In particular, this method aims to _never_ throw an exception
   * to its caller.
   *
   * @param {string} msg Incoming message, in JSON-encoded form.
   * @returns {object} The parsed message.
   */
  _decodeMessage(msg) {
    let id = -1; // Will get set if the message can be parsed enough to find it.

    try {
      msg = Decoder.decodeJson(msg);
      this._log.detail('Message:', msg);

      // Set `id` as early as possible, so that subsequent errors can be sent
      // with it.
      TObject.check(msg);
      id = TInt.min(msg.id, 0);

      // Having done that, validate the remainder of the message shape.
      TObject.withExactKeys(msg, ['id', 'target', 'action', 'name', 'args']);
      TString.nonempty(msg.target);
      TString.nonempty(msg.action);
      TString.nonempty(msg.name);
      TArray.check(msg.args);
    } catch (error) {
      return {error, id};
    }

    return msg;
  }

  /**
   * Helper for `_handleMessage()` which actually performs (well, queues up)
   * the action requested by the given message.
   *
   * @param {object} msg Parsed message.
   * @param {function} respond The responder function.
   */
  _actOnMessage(msg, respond) {
    const target = this._targets.get(msg.target);
    const action = msg.action;
    const name   = msg.name;
    const args   = msg.args;

    if (!target) {
      throw new Error(`Unknown target: \`${msg.target}\``);
    }

    switch (action) {
      case 'call': {
        target.call(name, args).then(
          (result) => { respond(result, null); },
          (error)  => { respond(null, error);  }
        );
        break;
      }

      // **Note:** Ultimately we might accept `get` and `set`, for example, thus
      // exposing a bit more of a JavaScript-like interface.

      default: {
        throw new Error(`Bad action: \`${action}\``);
      }
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
    this._log.info(`Close: ${codeStr}${msgStr}`);
  }

  /**
   * Handles an `error` event coming from the underlying websocket.
   *
   * @param {object} error The error event.
   */
  _handleError(error) {
    this._log.info('Error:', error);
  }

  /**
   * The connection ID.
   */
  get connectionId() {
    return this._connectionId;
  }

  /**
   * Gets the target associated with the indicated name. This will throw an
   * error if the named target does not exist.
   *
   * @param {string} name The target name.
   * @returns {object} The so-named target.
   */
  getTarget(name) {
    const result = this._targets.get(name);

    if (result === undefined) {
      throw new Error(`No such target: \`${name}\``);
    }

    return result;
  }
}
