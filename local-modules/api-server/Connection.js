// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Decoder, Encoder, Message } from 'api-common';
import { SeeAll } from 'see-all';
import { TString, TObject } from 'typecheck';
import { Random } from 'util-common';

import MetaHandler from './MetaHandler';
import Context from './Context';

/** Logger. */
const log = new SeeAll('api');

/**
 * {Connection|null} Connection associated with the current turn of execution
 * or `null` if no connection is currently active. This is set and reset within
 * `_actOnMessage()`.
 */
let activeNow = null;

/**
 * Base class for connections. Each `Connection` represents a single connection
 * over some mode of transport. Subclasses define the specifics of any given
 * mode of transport.
 *
 * This (base) class is directly responsible for interpreting and responding to
 * incoming message data, but without the actual transport of bytes over a
 * lower-level connection (or the like). This class in turn mostly bottoms out
 * by calling on target objects, which perform the actual application services.
 */
export default class Connection {
  /**
   * {Connection|null} The instance of this class that is currently active, or
   * `null` if no connection is active _within this turn of execution_. This is
   * _only_ non-null during an immediate synchronous call on a target object.
   * This variable exists so that targets can effect connection-specific
   * behavior, such as (notably) returning URLs that are sensible for a given
   * connection.
   */
  static get activeNow() {
    return activeNow;
  }

  /**
   * Checks that a value is an instance of this class. Throws an error if not.
   *
   * @param {*} value Value to check.
   * @returns {Connection} `value`.
   */
  static check(value) {
    return TObject.check(value, Connection);
  }

  /**
   * Constructs an instance. Each instance corresponds to a separate client
   * connection.
   *
   * @param {Context} context The binding context to provide access to.
   * @param {string} baseUrl The public-facing base URL for this connection.
   */
  constructor(context, baseUrl) {
    /** {Context} The binding context to provide access to. */
    this._context = Context.check(context).clone();

    /** {string} The public-facing base URL for this connection. */
    this._baseUrl = TString.nonempty(baseUrl);

    // We add a `meta` binding to the initial set of targets, which is specific
    // to this instance/connection.
    this._context.add('meta', new MetaHandler(this));

    /**
     * {string} Short label string used to identify this connection in logs.
     * _Probably_ but not _guaranteed_ to be unique.
     */
    this._connectionId = Random.shortLabel('conn');

    /** {Int} Count of messages received. Used for liveness logging. */
    this._messageCount = 0;

    /** {SeeAll} Logger which includes the connection ID as a prefix. */
    this._log = log.withPrefix(`[${this._connectionId}]`);

    this._log.info(`Open via <${this._baseUrl}>.`);
  }

  /** {string} The base URL. */
  get baseUrl() {
    return this._baseUrl;
  }

  /** {string} The connection ID. */
  get connectionId() {
    return this._connectionId;
  }

  /** {Context} The resource-binding context. */
  get context() {
    return this._context;
  }

  /**
   * Handles an incoming message, which is expected to be in JSON string form.
   * Returns a promise for the response, which is also in JSON string form.
   *
   * Notably, messages only succeed when addressed to _uncontrolled_ targets.
   * In order to act on a controlled target, it first needs to be authorized
   * via the meta-control system.
   *
   * **Note:** Subclasses are expected to call this.
   *
   * @param {string} msg Incoming message, in JSON string form.
   * @returns {Promise} Promise for the response. If there is an error, the
   *   promise will _resolve_ to the error response (as opposed to being
   *   rejected).
   */
  handleJsonMessage(msg) {
    return new Promise((res, rej_unused) => {
      msg = this._decodeMessage(msg); // Not supposed to ever throw.
      this._log.detail('Message:', msg);

      // Function to send a response. Arrow syntax so that `this` is usable.
      const respond = (result, error) => {
        const response = { id: msg.id };
        if (error) {
          response.error = error.message;
        } else {
          response.result = result;
        }

        if (error) {
          // TODO: Ultimately _some_ errors coming back from API calls shouldn't
          // be considered log-worthy server errors. We will need to
          // differentiate them at some point.
          this._log.error('Error:', error);
        }

        this._log.detail('Response:', response);

        // We resolve the promise successfully, whether or not the actual
        // handling of the message resulted in an error. That is, at this layer,
        // we can succeed in transporting a value which indicates a higher-level
        // error.
        res(Encoder.encodeJson(response));
      };

      if (msg.error) {
        respond(null, msg.error);
      } else {
        try {
          this._actOnMessage(msg).then(
            (result) => { respond(result, null); },
            (error)  => { respond(null, error);  }
          );
        } catch (e) {
          respond(null, e);
        }
      }
    });
  }

  /**
   * Helper for `handleJsonMessage()` which parses the original incoming
   * message. In case of error, this will return an object that binds `error` to
   * an appropriate exception; and in this case, `id` will be defined to be
   * either the successfully parsed message ID or `-1` if parsing couldn't even
   * make it that far. In particular, this method aims to _never_ throw an
   * exception to its caller.
   *
   * @param {string} msg Incoming message, in JSON-encoded form.
   * @returns {object} The parsed message.
   */
  _decodeMessage(msg) {
    try {
      msg = Decoder.decodeJson(msg);
    } catch (error) {
      // Hail-mary attempt to determine a reasonable `id`.
      let id = -1;
      if (Array.isArray(msg) && Number.isSafeInteger(msg[1])) {
        id = msg[1];
      }

      return { error, id };
    }

    return (msg instanceof Message)
      ? msg
      : { id: -1, error: new Error('Did not receive `Message` object.') };
  }

  /**
   * Helper for `handleJsonMessage()` which actually performs the action
   * requested by the given message.
   *
   * @param {object} msg Parsed message.
   * @returns {Promise} Promise for the result (or error).
   */
  _actOnMessage(msg) {
    const target = this._context.getUncontrolled(msg.target);
    const action = msg.action;
    const name   = msg.name;
    const args   = msg.args;

    switch (action) {
      case 'call': {
        return new Promise((res, rej) => {
          activeNow = this;
          try {
            res(target.call(name, args));
          } catch (e) {
            rej(e);
          }
          activeNow = null;
        });
      }

      // **Note:** Ultimately we might accept `get` and `set`, for example, thus
      // exposing a bit more of a JavaScript-like interface.

      default: {
        throw new Error(`Bad action: \`${action}\``);
      }
    }
  }
}
