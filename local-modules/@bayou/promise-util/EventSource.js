// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { EventEmitter } from 'events';

import { CommonBase, Errors, Functor } from '@bayou/util-common';

import { ChainedEvent } from './ChainedEvent';
import { EmitHandler } from './EmitHandler';

/**
 * Subclass of `EventEmitter` used by {@link EventSource}. This is set up to
 * only allow {@link #emit} to be called from the associated `EventSource`.
 */
class AssociatedEventEmitter extends EventEmitter {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    /** {boolean} Whether {@link #emit} is currently allowed. */
    this._canEmit = false;
  }

  /**
   * Implementation of standard interface. **Note:** On this class, it is only
   * possible to succeed in emitting an event via the effectively-protected
   * method {@link #_emitFunctor}.
   *
   * @param {string} eventName Name of the event to emit.
   * @param {...*} args Associated event arguments.
   */
  emit(eventName, ...args) {
    if (!this._canEmit) {
      throw Errors.badUse('Cannot emit directly.');
    }

    super.emit(eventName, ...args);
  }

  /**
   * Emits an event based on a {@link Functor} instance. The functor is
   * "exploded" into constituent parts for the event, e.g. the functor
   * `foo('x', 2)` would be emitted as an event with the name `'foo'` and two
   * additional arguments `'x'` and `2`.
   *
   * **Note:** This method is marked "private" but is in effect "protected." It
   * is called by {@link EventSource}.
   *
   * @param {Functor} payload The event to emit, in functor form.
   */
  _emitFunctor(payload) {
    try {
      this._canEmit = true;
      this.emit(payload.name, ...payload.args);
    } finally {
      this._canEmit = false;
    }
  }
}

/**
 * Event source for a chain of {@link ChainedEvent} instances. It is instances
 * of this class which are able to add new events to a chain, that is, this
 * class represents the authority to emit events on a particular chain (as
 * opposed to it being functionality exposed on `ChainedEvent` itself).
 *
 * As a bridge between traditional JavaScript event handling, this class
 * provides the property {@link #emitter}, which is an instance of the standard
 * class `EventEmitter` for use only to _listen for_ events (but not directly
 * emit them). This allows for the traditional `on()` and `off()` calls,
 * synchronous callbacks to added listeners, and so on. It is worth noting that
 * the usage pattern that `EventEmitter` encourages leads naturally to a
 * difficult-to-mitigate garbage accumulation issue (of effectively dead
 * listeners), and for that reason it is advisable to stick with the modern
 * promise-based approach primarily offered by this class.
 *
 * **Note:** This class does _not_ remember any events ever emitted by itself
 * other than the most recent, because doing otherwise would cause a garbage
 * accumulation issue. (Imagine a single instance of this class being actively
 * used during a session which lasts for, say, a month.)
 */
export class EventSource extends CommonBase {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    /**
     * {Proxy} Proxy which handles calls and accesses to the public property
     * {@link #emit}.
     */
    this._emitProxy = EmitHandler.makeFunctionProxy((...args) => this._emit(...args));

    /**
     * {AssociatedEventEmitter|null} Standard event emitter instance, or `null`
     * if {@link #emitter} has not yet been accessed.
     */
    this._emitter = null;

    /**
     * {ChainedEvent} Current (Latest / most recent) event emitted by this
     * instance. If this instance has never emitted, this is an initial "stub"
     * which is suitable for `await`ing in {@link #currentEvent}. (This
     * arrangement makes the logic in {@link #emit} particularly simple.)
     */
    this._currentEvent = new ChainedEvent(this, new Functor('chain_head'));

    /**
     * {boolean} Whether or not this instance has ever emitted an event. Used
     * to determine how to treat `_currentEvent` in {@link #currentEvent}.
     */
    this._everEmitted = false;

    Object.seal(this);
  }

  /**
   * {Promise<ChainedEvent>} Promise for the current (latest / most recent)
   * event emitted by this instance. This is an immediately-resolved promise in
   * all cases _except_ when this instance has never emitted an event. In the
   * latter case, it becomes resolved as soon as the first event is emitted.
   *
   * **Note:** Because of the chained nature of events, this property provides
   * access to all subsequent events emitted by this source.
   */
  get currentEvent() {
    if (this._everEmitted) {
      // `_currentEvent` is in fact a truly emitted event.
      return this._currentEvent;
    } else {
      // `_currentEvent` is just the initial stub that was made during
      // construction of this instance. _Its_ chained `next` event will be the
      // first actual event coming from this instance.
      return this._currentEvent.next;
    }
  }

  /**
   * {ChainedEvent|null} Current (Latest / most recent) event emitted by this
   * instance, or `null` if this instance has never emitted an event.
   *
   * **Note:** Because of the chained nature of events, this property (when
   * non-`null`) provides access to all subsequent events emitted by this
   * source.
   */
  get currentEventNow() {
    return this._everEmitted ? this._currentEvent : null;
  }

  /**
   * {EventEmitter} Standard-interface event emitter. This can be used for
   * interfacing with code that requires a listener-based event interface.
   * However, please refer to the header comment on this class for commentary
   * and recommendations.
   */
  get emitter() {
    if (this._emitter === null) {
      this._emitter = new AssociatedEventEmitter();
    }

    return this._emitter;
  }

  /**
   * {function} When called as a regular method, emits an event with the given
   * payload which must either be a single {@link Functor} argument or a name
   * followed by event payload arguments. When accessed as an object, will
   * return any named property as a function of arbitrary arguments which emits
   * an event of the same name as the property.
   */
  get emit() {
    return this._emitProxy;
  }

  /**
   * Emits an event with the given payload.
   *
   * @param {Functor|string} payloadOrName The event payload _or_ the name of
   *   the event.
   * @param {...*} args If `payloadOrName` is a string, the arguments to include
   *   with the event.
   * @returns {ChainedEvent} The emitted event.
   */
  _emit(payloadOrName, ...args) {
    const payload = (payloadOrName instanceof Functor)
      ? payloadOrName
      : new Functor(payloadOrName, ...args);
    const event = new ChainedEvent(this, payload);

    this._currentEvent._resolveNext(event);

    this._currentEvent = event;
    this._everEmitted  = true;

    if (this._emitter !== null) {
      this._emitter._emitFunctor(payload);
    }

    return event;
  }
}
