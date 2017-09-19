// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase, Functor } from 'util-common';

import ChainedEvent from './ChainedEvent';

/**
 * Event source for a chain of {@link ChainedEvent} instances. It is instances
 * of this class which are able to add new events to a chain, that is, this
 * class represents the authority to emit events on a particular chain (as
 * opposed to it being functionality exposed on `ChainedEvent` itself).
 *
 * **Note:** This class does _not_ remember any events ever emitted by itself
 * other than the most recent, because doing otherwise would cause a garbage
 * accumulation issue. (Imagine a single instance of this class being actively
 * used during a session which lasts for, say, a month.)
 */
export default class EventSource extends CommonBase {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();

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
   * {Promise<ChainedEvent>} Promise for the current (Latest / most recent)
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
   * Emits an event with the given payload.
   *
   * @param {Functor} payload The event payload.
   * @returns {ChainedEvent} The emitted event.
   */
  emit(payload) {
    const event = new ChainedEvent(this, payload);

    this._currentEvent._resolveNext(event);

    this._currentEvent = event;
    this._everEmitted  = true;

    return event;
  }
}
