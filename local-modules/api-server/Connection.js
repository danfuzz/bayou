// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Message } from 'api-common';
import { Codec } from 'codec';
import { Logger } from 'see-all';
import { TString } from 'typecheck';
import { CommonBase, Random } from 'util-common';

import ApiLog from './ApiLog';
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

    /** {ApiLog} The standard API logging handler. */
    this._apiLog = ApiLog.theOne;

    /** {Logger} Logger which includes the connection ID as a prefix. */
    this._log = log.withPrefix(`[${this._connectionId}]`);

    // We add a `meta` binding to the initial set of targets, which is specific
    // to this instance/connection.
    this._context.addEvergreen('meta', new MetaHandler(this));

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
      throw new Error('Closed.');
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
    throw new Error('Bad target.');
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
   * @returns {string} Response to the message, in JSON string form. This
   *   resolves after the message has been handled. If there was an error in
   *   handling the message, this will be an error response (as opposed to the
   *   method throwing an error). The intent is that this method _never_ throws
   *   errors.
   */
  async handleJsonMessage(msg) {
    msg = this._decodeMessage(msg); // Not supposed to ever throw.

    const startTime = this._apiLog.incomingMessage(this._connectionId, msg);
    let result = null;
    let error = null;

    if (msg.isError()) {
      error = new Error(msg.errorMessage);
    } else {
      try {
        result = await this._actOnMessage(msg);
      } catch (e) {
        error = e;
      }
    }

    // Set up the response contents, and encode it as the ultimate result of
    // this call.

    const response = { id: msg.id };
    if (error) {
      response.error = error.message;
    } else {
      response.result = result;
    }

    const encodedResponse = Codec.theOne.encodeJson(response);

    // Log the response. In the case of an error, we include the error's stack
    // trace. We intentionally _don't_ expose the stack trace as part of the
    // API result, as that arguably leaks sensitive info.

    if (error) {
      // This clause cleans it up so that it is an array of separate lines and
      // so that we omit the uninteresting parts of the file paths.
      response.errorStack = error.stack.match(/^ +at .*$/mg).map((line) => {
        // Lines that name functions are expected to be of the form:
        // * `    at func.name (/path/to/file:NN:NN)`
        // where `func.name` might actually be `new func.name` or
        // `func.name [as other.name]` (or both).
        let match = line.match(/^ +at ([^()]+) \(([^()]+)\)$/);
        let funcName;
        let filePath;

        if (match) {
          funcName = match[1];
          filePath = match[2];
        } else {
          // Anonymous functions (including top-level code) have the form:
          // * `    at /path/to/file:NN:NN`
          match = line.match(/^ +at ([^()]*)$/);
          funcName = '(anon)';
          filePath = match[1];
        }

        const fileSplit = filePath.match(/\/?[^/]+/g) || ['?'];
        const splitLen  = fileSplit.length;
        const fileName  = (splitLen < 2)
          ? fileSplit[0]
          : `...${fileSplit[splitLen - 2]}${fileSplit[splitLen - 1]}`;

        return `${funcName} (${fileName})`;
      });
    }

    this._apiLog.fullCall(this._connectionId, startTime, msg, response);
    return encodedResponse;
  }

  /**
   * Helper for `handleJsonMessage()` which actually performs the action
   * requested by the given message.
   *
   * @param {object} msg Parsed message.
   * @returns {*} Whatever the dispatched message returns.
   */
  async _actOnMessage(msg) {
    const target = this.getTarget(msg.target);
    const action = msg.action;
    const name   = msg.name;
    const args   = msg.args;

    switch (action) {
      case 'call': {
        activeNow = this;
        try {
          return target.call(name, args);
        } finally {
          activeNow = null;
        }
      }

      // **Note:** Ultimately we might accept `get` and `set`, for example, thus
      // exposing a bit more of a JavaScript-like interface.

      default: {
        throw new Error(`Bad action: \`${action}\``);
      }
    }
  }

  /**
   * Helper for `handleJsonMessage()` which parses the original incoming
   * message.
   *
   * In case of error, this method still aims to return a message and not throw
   * an error. Specifically, this will return a message for which `isError()`
   * returns `true`. And in such cases, `id` will be defined to be either the
   * successfully parsed message ID or `-1` if parsing couldn't even make it
   * that far.
   *
   * @param {string} msg Incoming message, in JSON-encoded form.
   * @returns {Message} The parsed message or a `Message` instance representing
   *   a parse error.
   */
  _decodeMessage(msg) {
    try {
      msg = Codec.theOne.decodeJson(msg);
    } catch (error) {
      // Hail-mary attempt to determine a reasonable `id`.
      let id = -1;
      if (Array.isArray(msg) && Number.isSafeInteger(msg[1])) {
        id = msg[1];
      }

      return Message.error(id, error.message);
    }

    return ((msg instanceof Message) && !msg.isError())
      ? msg
      : Message.error(-1, 'Did not receive `Message` object.');
  }
}
