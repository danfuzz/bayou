// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { EventSource, CallPiler } from '@bayou/promise-util';
import { Logger } from '@bayou/see-all';
import { TBoolean, TString } from '@bayou/typecheck';
import { CommonBase, Functor } from '@bayou/util-common';

/** {string} Value used for an unknown connection ID. */
const UNKNOWN_CONNECTION_ID = 'id_unknown';

/** {Logger} Logger. */
const log = new Logger('api-conn');

/**
 * Base class which abstracts away details of a connection to a server. This
 * class provides a promise-chained sequence of events representing both
 * enqueued and received messages, along with an interface for queuing up
 * messages to send to the far side of the connection.
 *
 * **Note:** At this layer, messages are all strings. **TODO:** They should be
 * binary (arrays of bytes) instead.
 *
 * **TODO:** This class is an as-yet nonfunctional work-in-progress. See the
 * header comment in {@link ApiClient} for more details.
 */
export default class BaseServerConnection extends CommonBase {
  /** {string} Event name to use for received messages. */
  static get EVENT_receive() { return 'receive'; }

  /** {string} Event name to use for messages to send. */
  static get EVENT_send() { return 'send'; }

  /** {string} Event name to use for the very first event emitted. */
  static get EVENT_start() { return 'start'; }

  /**
   * Constructs an instance. Once constructed, it is valid to send messages
   * via the instance; should the connection not be fully established, any
   * sent messages are queued up and will be sent in-order once the
   * connection is ready.
   */
  constructor() {
    super();

    /**
     * {Logger} Logger which prefixes everything with the connection ID (if
     * available). Set in {@link #_updateLogger}, which is called whenever
     * {@link #_connectionId} is updated.
     */
    this._log = log;

    /** {string} State of the connection. One of the `STATE_*` constants. */
    this._state = BaseServerConnection.STATE_closed;

    /** {string} Connection ID conveyed to us by the user of this instance. */
    this._connectionId = UNKNOWN_CONNECTION_ID;

    /** {EventSource} Emitter used for the events of this instance. */
    this._events = new EventSource();
    this._events.emit(new Functor(BaseServerConnection.EVENT_start));

    /**
     * {ChainedEvent} The "head" of the event chain after which any `receive`
     * events have not yet been accepted by the user of this instance.
     */
    this._receiveHead = this._events.currentEventNow;

    /**
     * {ChainedEvent} The "head" of the event chain after which any `send`
     * events have not yet been handed off to the subclass.
     */
    this._sendHead = this._events.currentEventNow;

    /**
     * {CallPiler} Call piler that ensures that at most one call to
     * {@link #sendAll} is active at any given time.
     */
    this._sendAllPiler = new CallPiler(() => this._sendAll());
  }

  /**
   * {string} The connection ID if known, or a reasonably suggestive string if
   * not. The client of this instance is responsible for setting this. If set
   * to `null`, it will instead become aforementioned "reasonably suggestive"
   * string.
   */
  get connectionId() {
    return this._connectionId;
  }

  set connectionId(id) {
    this._connectionId = (id === null)
      ? UNKNOWN_CONNECTION_ID
      : TString.nonEmpty(id);

    this._updateLogger();
  }

  /**
   * {ChainedEvent} The most recently emitted event from this instance. This
   * is a `start` event before any "real" activity has occurred on an instance.
   */
  get currentEventNow() {
    return this._events.currentEventNow;
  }

  /**
   * {Logger} The client-specific logger.
   */
  get log() {
    return this._log;
  }

  /**
   * Accepts a message sent by the far side of the connection. This method only
   * returns once a message is available.
   *
   * @returns {string} The message that was received from the far side of the
   *   connection.
   */
  async acceptMessage() {
    for (;;) {
      const event = this._receiveHead.nextOfNow(BaseServerConnection.EVENT_receive);
      if (event !== null) {
        const [message] = event.payload.args;
        this._receiveHead = event;
        return message;
      }

      // There are no received messages that haven't yet been handled. Make sure
      // the subclass is trying to receive, and then wait for one to show up on
      // the event chain. Once an event shows up, loop back and try to get to it
      // synchronously via the code above, to avoid the possibility of returning
      // the same message twice.
      await this._impl_beReceiving();
      await this._receiveHead.nextOf(BaseServerConnection.EVENT_receive);
    }
  }

  /**
   * Queues up a message to send to the far side of the connection. If the
   * connection is active, the message will in fact be sent during the next
   * chunk of event processing, as kicked off by {@link #sendAll}.
   *
   * @param {string} message Message to send.
   */
  async enqueue(message) {
    TString.check(message);
    this._events.emit(new Functor(BaseServerConnection.EVENT_send, message));
  }

  /**
   * Indicates whether or not this instance is connected to `localhost`. This is
   * mostly of use during testing.
   *
   * @returns {boolean} `true` iff this instance's server is running locally.
   */
  isLocal() {
    return TBoolean.check(this._impl_isLocal());
  }

  /**
   * Indicates whether or not this instance believes it is sufficiently open,
   * such that it is possible to send messages. This method returns `true` if
   * the instance is in the middle of opening (and is enqueuing messages) or is
   * fully open and actively exchanging messages with a server.
   *
   * @returns {boolean} `true` iff this instance is open, per above.
   */
  isOpen() {
    return TBoolean.check(this._impl_isOpen());
  }

  /**
   * Indicates that a new message has been received. This is meant to be used by
   * subclasses.
   *
   * @param {string} message Message which was received.
   */
  async received(message) {
    TString.check(message);
    this._events.emit(new Functor(BaseServerConnection.EVENT_receive, message));
  }

  /**
   * Sends all messages that have been enqueued by {@link #enqueue} that have
   * not already been sent. If there is any sort of (non-recoverable) connection
   * trouble, it will show up here as a thrown error.
   */
  async sendAll() {
    // Call `_sendAll()` if not already in progress, or if in progress merely
    // wait for the return of that in-progress call.
    await this._sendAllPiler.call();
  }

  /**
   * Makes sure that the instance is in a position to receive messages from the
   * far side of the connection.
   *
   * @abstract
   */
  async _impl_beReceiving() {
    this._mustOverride();
  }

  /**
   * Subclass-specific implementation of {@link #isLocal}.
   *
   * @abstract
   * @returns {boolean} `true` iff this instance connects to a locally-running
   *   server.
   */
  _impl_isLocal() {
    return this._mustOverride();
  }

  /**
   * Subclass-specific implementation of {@link #isOpen}.
   *
   * @abstract
   * @returns {boolean} `true` iff this instance is open.
   */
  _impl_isOpen() {
    return this._mustOverride();
  }

  /**
   * Sends the given message, on a best-effort basis. Returns normally if this
   * instance optimistically "believes" the message was successfully sent, or
   * throws an error to indicate there was some kind of trouble. Subclasses must
   * implement this.
   *
   * **Note:** The structure of this (base) class ensures that only one call to
   * this method will be ongoing at any given time. See {@link #sendAll} and
   * {@link #_sendAll} for details.
   *
   * @abstract
   * @param {string} message The message to send.
   */
  async _impl_sendMessage(message) {
    this._mustOverride(message);
  }

  /**
   * Underlying implementation of {@link #sendAll}. Calls to this method are
   * wrapped by {@link #_sendAllPiler} to ensure only one call is active at any
   * given time.
   */
  async _sendAll() {
    let e = this._sendHead;

    for (;;) {
      e = e.nextOfNow(BaseServerConnection.EVENT_send);

      if (e === null) {
        break;
      }

      // We found a message to send. _First_ tell the subclass to do its thing,
      // and only after it returns successfully, update the `_sendHead`. This
      // ordering ensures that we don't drop messages _at this layer_ (but it
      // could still happen at other layers). Because only one call to this
      // method is active at any time, that also means that only one call to
      // `_impl_sendMessage()` (immediately below) is active at any time. This
      // is why it's safe to manipulate `_sendHead` as we do here.
      const [message] = e.payload.args;
      await this._impl_sendMessage(message);
      this._sendHead = e;
    }
  }

  /**
   * Updates {@link #_log} based on {@link #_connectionId}.
   */
  _updateLogger() {
    const id = (this._connectionId === UNKNOWN_CONNECTION_ID)
      ? 'unknown'
      : this._connectionId;

    this._log = log.withAddedContext(id);
  }
}
