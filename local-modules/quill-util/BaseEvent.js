// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase, Functor } from 'util-common';

/**
 * Base class for promise-chainable events. Each event is chained to the next
 * event which gets emitted by the same source. The chain is available both
 * synchronously and asynchronously. In the synchronous case, it is possible to
 * run into the end of the chain, represented by `null`. In the asynchronous
 * case, the properties and accessors return promises that only become resolved
 * once an appropriate event has been emitted.
 *
 * This base class provides a couple of abstract methods to define the basic
 * interface, a couple of helper methods to walk the chain, and access to the
 * event payload (which is a constructor argument). Subclasses are responsible
 * for arranging for the event chain to become constructed.
 */
export default class BaseEvent extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Functor} payload Event payload (name and arguments).
   */
  constructor(payload) {
    super();

    /** {Functor} Event payload (name and arguments). */
    this._payload = Functor.check(payload);
  }

  /** {string} Name of the event. */
  get eventName() {
    return this._payload.name;
  }

  /** {Functor} Event payload (name and arguments). */
  get payload() {
    return this._payload;
  }

  /**
   * {Promise<BaseEvent>} Promise for the next event in the chain after this
   * instance, which becomes resolved once it is available.
   */
  get next() {
    throw this._mustOverride();
  }

  /**
   * {BaseEvent|null} The next event in the chain after this instance if it
   * is immediately available, or `null` if there is not yet a next event.
   */
  get nextNow() {
    throw this._mustOverride();
  }

  /**
   * Gets the earliest event of the indicated name in the event chain, starting
   * at (and possibly including) this instance. This method only returns once a
   * matching event is available.
   *
   * @param {string} eventName Event name of interest.
   * @returns {BaseEvent} The earliest event with the indidated name, starting
   *   at this instance.
   */
  async earliestOf(eventName) {
    for (let e = this; /*e*/; e = await e.next) {
      const resultNow = e.earliestOfNow(eventName);
      if (resultNow !== null) {
        return resultNow;
      }
    }
  }

  /**
   * Gets the earliest immediately-available event of the indicated name in the
   * event chain, starting at (and possibly including) this instance. If no
   * matching event is immediately available, this method returns `null`.
   *
   * @param {string} eventName Event name of interest.
   * @returns {BaseEvent|null} The earliest immediately-available event with
   *   the indidated name, starting at this instance; or `null` if there is no
   *   such event.
   */
  earliestOfNow(eventName) {
    for (let e = this; e !== null; e = e.nextNow) {
      if (e.eventName === eventName) {
        return e;
      }
    }

    return null;
  }

  /**
   * Gets the latest (most recent) event of the indicated name in the event
   * chain, starting at (and possibly including) this instance. This method only
   * returns once a matching event is available.
   *
   * @param {string} eventName Event name of interest.
   * @returns {BaseEvent|null} The latest immediately-available event with the
   *   indidated name, starting at this instance; or `null` if there is no
   *   such event.
   */
  async latestOf(eventName) {
    const resultNow = this.latestOfNow(eventName);

    if (resultNow !== null) {
      return resultNow;
    } else {
      // Wait for at least one matching event, and then get the instantaneously-
      // latest (because there could have been more than one).
      const next = await this.nextOf(eventName);
      return next.latestOfNow(eventName);
    }
  }

  /**
   * Gets the latest (most recent) immediately-available event of the indicated
   * name in the event chain, starting at (and possibly including) this
   * instance. If no matching event is immediately available, this method
   * returns `null`.
   *
   * @param {string} eventName Event name of interest.
   * @returns {BaseEvent|null} The latest immediately-available event with the
   *   indidated name, starting at this instance; or `null` if there is no
   *   such event.
   */
  latestOfNow(eventName) {
    let result = null;

    for (let e = this; e !== null; e = e.nextNow) {
      if (e.eventName === eventName) {
        result = e;
      }
    }

    return result;
  }

  /**
   * Gets the next event of the indicated name after this instance, whenever it
   * becomes resolved.
   *
   * @param {string} eventName Event name of interest.
   * @returns {BaseEvent} The next event with the indidated name, once it has
   *   become resolved.
   */
  async nextOf(eventName) {
    return (await this.next).earliestOf(eventName);
  }

  /**
   * Gets the next event of the indicated name after this instance, if it is
   * immediately available.
   *
   * @param {string} eventName Event name of interest.
   * @returns {BaseEvent|null} The next event with the indidated name that has
   *   already been resolved, or `null` if there is no such event.
   */
  nextOfNow(eventName) {
    const nextNow = this.nextNow;
    return (nextNow === null) ? null : nextNow.earliestOfNow(eventName);
  }

  /**
   * Constructs a new event which is set up to be at the head of an event chain
   * which continues with _this_ instance's next event, but with a different
   * event name and payload. Put another way, this constructs a replacement
   * event for this instance, but with the same chaining.
   *
   * @param {Functor} payload Event payload (name and arguments).
   * @returns {BaseEvent} New event instance with the given `payload`, and
   *   whose `next` and `nextNow` behave the same as this instance's properties
   *   of the same names.
   */
  withNewPayload(payload) {
    const result = new BaseEvent(payload);
    Object.defineProperties(result, {
      next:    { get: () => { return this.next;    } },
      nextNow: { get: () => { return this.nextNow; } }
    });

    Object.assign(result, payload);
    Object.freeze(result);
    return result;
  }

  /**
   * Constructs a new event which &mdash; from its perspective &mdash; is
   * "pushed" onto the head of the event chain that continues with this
   * instance. That is, the constructed event's `next` and `nextNow` immediately
   * point at this instance.
   *
   * @param {Functor} [payload = new Functor('none')] Event payload (name and
   *   arguments).
   * @returns {BaseEvent} New event instance with `payload` properties, and
   *   whose `next` and `nextNow` refer to this instance.
   */
  withPushedHead(payload = new Functor('none')) {
    const result = new BaseEvent(payload);
    Object.defineProperties(result, {
      next:    { get: () => { return Promise.resolve(this); } },
      nextNow: { get: () => { return this;                  } }
    });

    Object.assign(result, payload);
    Object.freeze(result);
    return result;
  }
}
