// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { EventSource } from '@bayou/prom-util';
import { Logger } from '@bayou/see-all';
import { TString } from '@bayou/typecheck';
import { CommonBase, Errors, Functor } from '@bayou/util-common';

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
 */
export default class BaseServerConnection extends CommonBase {
  /** {string} Event name to use for received messages. */
  static get EVENT_receive() { return 'receive'; }

  /** {string} Event name to use for messages to send. */
  static get EVENT_send() { return 'send'; }

  /** {string} Event name to use for the very first event emitted. */
  static get EVENT_start() { return 'start'; }

  /** {string} Connection state "closed" (no currenct connection). */
  static get STATE_closed() { return 'closed'; }

  /** {string} Connection state "opening" (in the process of becoming open). */
  static get STATE_opening() { return 'opening'; }

  /** {string} Connection state "open" (open and active). */
  static get STATE_open() { return 'open'; }

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

    /** {string} Connection ID conveyed to us by the server. */
    this._connectionId = UNKNOWN_CONNECTION_ID;

    /** {EventSource} Emitter used for the events of this instance. */
    this._events = new EventSource();

    this._events.emit(new Functor(BaseServerConnection.EVENT_start));
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
   * {string} State of the connection. One of the static `STATE_*` constants
   * defined by this class. It is up to subclasses to update this value.
   */
  get state() {
    return this._state;
  }

  set state(state) {
    switch (state) {
      case BaseServerConnection.STATE_closed:
      case BaseServerConnection.STATE_open:
      case BaseServerConnection.STATE_opening: {
        // Valid.
        break;
      }

      default: {
        throw Errors.badValue(state, String, 'connection state');
      }
    }

    this._state = state;
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
    // TODO
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
