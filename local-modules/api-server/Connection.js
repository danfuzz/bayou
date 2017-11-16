// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ConnectionError, Message, Response } from 'api-common';
import { Logger } from 'see-all';
import { TString } from 'typecheck';
import { CommonBase, Errors, Random } from 'util-common';

import BearerToken from './BearerToken';
import MetaHandler from './MetaHandler';
import Context from './Context';

/** {Logger} Logger. */
const log = new Logger('api');

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
 *
 * **Note:** The `context` used for the connection is set up as a separate
 * instance (effectively cloned) from the one passed into the constructor and
 * always has an extra binding of `meta` to a meta-control object that is
 * specific to the connection.
 */
export default class Connection extends CommonBase {
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
   * Constructs an instance. Each instance corresponds to a separate client
   * connection.
   *
   * @param {Context} context The binding context to provide access to. This
   *   value gets cloned, so that changes to the `this.context` do not affect
   *   the originally passed value.
   * @param {string} baseUrl The public-facing base URL for this connection.
   */
  constructor(context, baseUrl) {
    super();

    /** {Context} The binding context to provide access to. */
    this._context = Context.check(context).clone();

    /** {string} The public-facing base URL for this connection. */
    this._baseUrl = TString.urlOrigin(baseUrl);

    /**
     * {string} Short label string used to identify this connection in logs.
     * _Probably_ but not _guaranteed_ to be unique.
     */
    this._connectionId = Random.shortLabel('conn');

    /** {Int} Count of messages received. Used for liveness logging. */
    this._messageCount = 0;

    /** {ApiLog} The API logger to use. */
    this._apiLog = context.apiLog;

    /** {Codec} The codec to use. */
    this._codec = context.codec;

    /** {Logger} Logger which includes the connection ID as a prefix. */
    this._log = log.withPrefix(`[${this._connectionId}]`);

    // We add a `meta` binding to the initial set of targets, which is specific
    // to this instance/connection.
    this._context.addEvergreen('meta', new MetaHandler(this));

    this._log.info('Open via:', this._baseUrl);
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

  /** {Logger} Connection-specific logger. */
  get log() {
    return this._log;
  }

  /**
   * Prevents this instance from handling further messages, and enables
   * garbage collection of dependent resources, e.g. and specifically anything
   * referenced by the `context`.
   *
   * **Note:** This method is used to explicitly manage the lifecycle of a
   * connection. This is a useful thing to do in that the outer application
   * server doesn't necessarily make strong guarantees about promptly cleaning
   * up its connection-related state.
   */
  close() {
    this._log.info('Closed.');
    this._context = null;
  }

  /**
   * Gets the target of the given message. This uses the message's `target` and
   * either finds it as an ID directly, or if that is a no-go, tries it as the
   * string form of a bearer token. If neither succeeds, this will throw an
   * error.
   *
   * @param {string} idOrToken A target ID or bearer token in string form.
   * @returns {Target} The target object that is associated with `idOrToken`.
   */
  getTarget(idOrToken) {
    const context = this._context;

    if (context === null) {
      throw ConnectionError.connection_closed(this._connectionId, 'Connection closed.');
    }

    let target = context.getUncontrolledOrNull(idOrToken);

    if (target !== null) {
      return target;
    }

    const token = BearerToken.coerceOrNull(idOrToken);
    if (token !== null) {
      target = context.getOrNull(token.id);
      if ((target !== null) && token.sameToken(target.key)) {
        return target;
      }
    }

    // We _don't_ include the passed argument, as that might end up revealing
    // secret info.
    throw Errors.bad_use('Invalid target.');
  }

  /**
   * Handles an incoming message, which is expected to be in JSON string form.
   * Returns a JSON string response.
   *
   * Notably, messages only succeed in getting acted upon when addressed to
   * _uncontrolled_ targets. In order to act on a controlled target, that target
   * first needs to be authorized via the meta-control system so as to become
   * uncontrolled on a specific connection.
   *
   * **Note:** Subclasses are expected to call this method.
   *
   * @param {string} msg Incoming message, in JSON string form.
   * @returns {string} Response to the message, in JSON string form. This
   *   resolves after the message has been handled. If there was an error in
   *   handling the message, this will be an error response (as opposed to the
   *   method throwing an error). The intent is that this method _never_ throws
   *   errors.
   */
  async handleJsonMessage(msg) {
    msg = this._decodeMessage(msg); // Not supposed to ever throw.

    const startTime = Date.now();
    let result = null;
    let error = null;

    if (msg instanceof Message) {
      this._apiLog.incomingMessage(this._connectionId, startTime, msg);
      try {
        result = await this._actOnMessage(msg);
      } catch (e) {
        error = e;
      }
    } else if (msg instanceof Error) {
      error = msg;
      msg = null; // Salient for logging.
    } else {
      // Shouldn't happen because `_decodeMessage()` should only return one of
      // the above two types.
      throw Errors.wtf('Weird return value from `_decodeMessage()`.');
    }

    // Set up the response contents, encode it as the ultimate result of
    // this call, log it, and return it for ulimate transmission back to the
    // caller.

    const response = new Response(msg.id, result, error);
    const encodedResponse = this._codec.encodeJson(response);

    this._apiLog.fullCall(this._connectionId, startTime, msg, response);

    return encodedResponse;
  }

  /**
   * Helper for `handleJsonMessage()` which actually performs the method call
   * requested by the given message.
   *
   * @param {Message} msg Parsed message.
   * @returns {*} Whatever the called method returns.
   */
  async _actOnMessage(msg) {
    const target = this.getTarget(msg.target);

    activeNow = this;
    try {
      return target.call(msg.payload);
    } finally {
      activeNow = null;
    }
  }

  /**
   * Helper for `handleJsonMessage()` which parses the original incoming
   * message.
   *
   * @param {string} msg Incoming message, in JSON-encoded form.
   * @returns {Message|ConnectionError} The parsed message or an error
   *   indicating message parsing trouble.
   */
  _decodeMessage(msg) {
    try {
      msg = this._codec.decodeJson(msg);
    } catch (error) {
      return ConnectionError.connection_nonsense(this._connectionId, error.message);
    }

    if (msg instanceof Message) {
      return msg;
    }

    return ConnectionError.connection_nonsense(
      this._connectionId, 'Did not receive `Message` object.');
  }
}
