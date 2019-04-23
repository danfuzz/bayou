// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ConnectionError, Message, Response } from '@bayou/api-common';
import { Logging } from '@bayou/config-server';
import { Condition } from '@bayou/promise-util';
import { Logger } from '@bayou/see-all';
import { TBoolean } from '@bayou/typecheck';
import { CommonBase, Errors, Random } from '@bayou/util-common';

import ApiLog from './ApiLog';
import ContextInfo from './ContextInfo';
import MetaHandler from './MetaHandler';
import ProxiedObject from './ProxiedObject';
import Target from './Target';

/** {Logger} Logger for this module. */
const log = new Logger('api');

/**
 * Base class for connections. Each instance (of a concrete subclass) represents
 * a single connection over some mode of transport. Subclasses define the
 * specifics of any given mode of transport.
 *
 * This (base) class is directly responsible for interpreting and responding to
 * incoming message data, but without the actual transport of bytes over a
 * lower-level connection (or the like). This class in turn mostly bottoms out
 * by calling on target objects, which perform the actual application services.
 */
export default class BaseConnection extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {ContextInfo} contextInfo Construction info for the {@link Context}
   *   to use.
   */
  constructor(contextInfo) {
    super();

    /**
     * {string} Short label string used to identify this connection in logs.
     * _Probably_ but not _guaranteed to be_ unique.
     */
    this._connectionId = Random.shortLabel('conn');

    /**
     * {Logger} Logger which includes the connection ID in the logging context.
     */
    this._log = log.withAddedContext(this._connectionId);

    /** {Context} The binding context to provide access to. */
    this._context = ContextInfo.check(contextInfo).makeContext(this._log);

    /** {Codec} The codec to use. */
    this._codec = this._context.codec;

    /** {ApiLog} The API logger to use. */
    this._apiLog = new ApiLog(this._log, Logging.shouldRedact());

    /** {boolean} Whether the connection should be aiming to become closed. */
    this._closing = false;

    /**
     * {Condition} Condition which becomes `true` when the connection is
     * closed.
     */
    this._closedCondition = new Condition();

    // Add a `meta` binding to the initial set of targets, which is specific to
    // this instance/connection.
    const metaTarget = new Target('meta', new MetaHandler(this));
    this._context.addTarget(metaTarget);

    this._log.event.open();
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
  async close() {
    if (this._closing) {
      await this._closedCondition.whenTrue();
      return;
    }

    this._closing = true;
    this._log.event.closing();

    await this._impl_close();

    this._context = null;
    this._closedCondition.value = true;

    this._log.event.closed();
  }

  /**
   * Handles an incoming message, which is expected to be in JSON string form.
   * Returns a JSON string response.
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

    let target = null;
    let result = null;
    let error  = null;

    if (msg instanceof Message) {
      this._apiLog.incomingMessage(msg);
      try {
        target = await this._getTarget(msg);
        result = await this._actOnMessage(msg, target);
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

    const response        = new Response((msg === null) ? 0 : msg.id, result, error);
    const encodedResponse = this._encodeResponse(response);

    if (msg === null) {
      this._apiLog.nonMessageResponse(response);
    } else {
      this._apiLog.fullCall(msg, response);
    }

    return encodedResponse;
  }

  /**
   * Indicates whether or not this connection is currently trying to become
   * closed.
   *
   * @returns {boolean} `true` if the connection should be heading towards
   *   being closed, or `false` if not.
   */
  isClosing() {
    return this._closing;
  }

  /**
   * Indicates whether or not this connection is currently open (able to
   * receive and/or send data).
   *
   * @returns {boolean} `true` if the connection is open, or `false` if not.
   */
  isOpen() {
    return TBoolean.check(this._impl_isOpen());
  }

  /**
   * Encodes a message suitable for sending to the other side of this
   * connection.
   *
   * @param {Message} message Message to encode.
   * @returns {string} Encoded form of `message`.
   */
  encodeMessage(message) {
    Message.check(message);

    return this._codec.encodeJson(message);
  }

  /**
   * Subclass-specific implementation of {@link #close}. This is called and
   * `await`ed upon before the base class performs its final cleanup. The
   * intention is that this method _not_ force unsafe closure, but rather that
   * it hasten an orderly shutdown of the connection.
   */
  async _impl_close() {
    this._mustOverride();
  }

  /**
   * Subclass-specific implementation of {@link #isOpen}.
   *
   * @returns {boolean} `true` if the connection is open, or `false` if not.
   */
  _impl_isOpen() {
    return this._mustOverride();
  }

  /**
   * Helper for {@link @handleJsonMessage} which actually performs the method
   * call requested by the given message.
   *
   * Because `undefined` is not used across the API boundary, a top-level
   * `undefined` result (which, notably, is what is returned from a method that
   * just falls through to the end or `return`s without specifying a value) is
   * replaced by `null`.
   *
   * In addition, if the result is an instance of {@link ProxiedObject}, it
   * is replaced with a {@link Remote} which can represent it across the API
   * boundary.
   *
   * @param {Message} msg Parsed message.
   * @param {Target} target Target of the message, as previously returned from
   *   {@link #_getTarget}.
   * @returns {*} Whatever the called method returns, except `null` replacing
   *   `undefined`.
   */
  async _actOnMessage(msg, target) {
    if (this._closing) {
      // The connection is in the process of getting closed. Just reject the
      // message outright.
      throw ConnectionError.connectionClosing(this._connectionId);
    }

    const result = await target.call(msg.payload);

    if (result === undefined) {
      // See method header comment.
      return null;
    } else if (result instanceof ProxiedObject) {
      // The result isn't a regular encodable value. Instead, it will end up
      // proxied across the connection. This is achieved by encoding it as a
      // `Remote`, which the far side of the connection will convert into a
      // proxy on its side. **TODO:** This conversion shouldn't just be limited
      // to direct return values.
      return this._context.getRemoteFor(result);
    } else {
      return result;
    }
  }

  /**
   * Helper for {@link #handleJsonMessage()} which parses the original incoming
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
      return ConnectionError.connectionNonsense(this._connectionId, error.message);
    }

    if (msg instanceof Message) {
      const auth     = this._context.tokenAuthorizer;
      const targetId = msg.targetId;

      if (auth.isToken(targetId)) {
        // The `targetId` is a token string. Replace the string with an actual
        // `BearerToken` instance.
        return msg.withTargetId(auth.tokenFromString(targetId));
      }

      return msg;
    }

    return ConnectionError.connectionNonsense(
      this._connectionId, 'Did not receive `Message` object.');
  }

  /**
   * Helper for {@link #handleJsonMessage()} which encodes a response for
   * sending back to the far side of a connection.
   *
   * @param {Response} response The response in question.
   * @returns {string} The encoded form of `response`.
   */
  _encodeResponse(response) {
    let problemValue;

    try {
      return this._codec.encodeJson(response);
    } catch (e) {
      if (response.isError()) {
        // There is probably some bit of structured data in the error which
        // can't get encoded. Stringify it, and try again.
        try {
          response = response.withConservativeError(response);
          return this._codec.encodeJson(response);
        } catch (subError) {
          // Ignore this (inner) error, and fall through to report the original
          // problem.
        }

        this._log.event.unencodableError(response, e);
        problemValue = response.error;
      } else {
        this._log.event.unencodableResult(response, e);
        problemValue = response.result;
      }
    }

    // Last-ditch attempt to send a breadcrumb back to the caller.
    const newError    = ConnectionError.couldNotEncode(problemValue);
    const newResponse = new Response(response.id, null, newError).withConservativeError();
    return this._codec.encodeJson(newResponse);
  }

  /**
   * Gets the target of the given message. This uses the message's `target` and
   * either finds it as an ID directly, or if that is a no-go, tries it as the
   * string form of a bearer token. If neither succeeds, this will throw an
   * error.
   *
   * **Note:** This method is `async` because it is possible that it ends up
   * having to do a heavyweight operation (e.g. a network round-trip) to
   * determine the authority of a token.
   *
   * @param {Message} msg The message whose target is to be determined.
   * @returns {Target} The target object that is associated with `msg`.
   */
  async _getTarget(msg) {
    Message.check(msg);

    const targetId = msg.targetId;
    const context  = this._context;

    if (context === null) {
      throw ConnectionError.connectionClosed(this._connectionId, 'Connection closed.');
    }

    const result = await context.getAuthorizedTarget(targetId);

    return Target.check(result);
  }
}
