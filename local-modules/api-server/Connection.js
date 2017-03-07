// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Decoder, Encoder, Message } from 'api-common';
import { SeeAll } from 'see-all';
import { Random } from 'util-common';

import MetaHandler from './MetaHandler';
import TargetMap from './TargetMap';

/** Logger. */
const log = new SeeAll('api');

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
   * Constructs an instance. Each instance corresponds to a separate client
   * connection.
   *
   * @param {TargetMap} targets The targets to provide access to.
   */
  constructor(targets) {
    /** {TargetMap} The targets to provide access to. */
    this._targets = TargetMap.check(targets).clone();

    // We add a `meta` binding to the initial set of targets, which is specific
    // to this instance/connection.
    this._targets.add('meta', new MetaHandler(this));

    /**
     * {string} Short label string used to identify this connection in logs.
     * _Probably_ but not _guaranteed_ to be unique.
     */
    this._connectionId = Random.shortLabel('conn');

    /** {Int} Count of messages received. Used for liveness logging. */
    this._messageCount = 0;

    /** {SeeAll} Logger which includes the connection ID as a prefix. */
    this._log = log.withPrefix(`[${this._connectionId}]`);

    this._log.info('Open.');
  }

  /**
   * Handles an incoming message, which is expected to be in JSON string form.
   * Returns a promise for the response, which is also in JSON string form.
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
        const response = {id: msg.id};
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

      return {error, id};
    }

    return (msg instanceof Message)
      ? msg
      : {id: -1, error: new Error('Did not receive `Message` object.')};
  }

  /**
   * Helper for `handleJsonMessage()` which actually performs (well, queues up)
   * the action requested by the given message.
   *
   * @param {object} msg Parsed message.
   * @returns {Promise} Promise for the result (or error).
   */
  _actOnMessage(msg) {
    const target = this._targets.get(msg.target);
    const action = msg.action;
    const name   = msg.name;
    const args   = msg.args;

    if (!target) {
      throw new Error(`Unknown target: \`${msg.target}\``);
    }

    switch (action) {
      case 'call': {
        return target.call(name, args);
      }

      // **Note:** Ultimately we might accept `get` and `set`, for example, thus
      // exposing a bit more of a JavaScript-like interface.

      default: {
        throw new Error(`Bad action: \`${action}\``);
      }
    }
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
