// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase, Errors, Functor } from '@bayou/util-common';

import { EventSource } from './EventSource';

/**
 * Promise-chained event. Each instance becomes chained to the next event which
 * gets emitted by the same source. The chain is available both synchronously
 * and asynchronously. In the synchronous case, it is possible to run into the
 * end of the chain, represented by `null`. In the asynchronous case, the
 * properties and accessors return promises that only become resolved once an
 * appropriate event has been emitted by the source.
 */
export class ChainedEvent extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {EventSource} source Source of this event.
   * @param {Functor} payload Event payload (name and arguments).
   */
  constructor(source, payload) {
    super();

    /**
     * {EventSource} Source of this event. This is used to validate the chaining
     * of events.
     *
     * **Note:** It is important to _not_ reveal this value as a
     * publicly-accessible property, because that would violate the intended
     * design whereby access to an event does _not_ convey permission to emit
     * new events on the associated chain.
     */
    this._source = EventSource.check(source);

    /** {Functor} Event payload (name and arguments). */
    this._payload = Functor.check(payload);

    /**
     * {ChainedEvent|null} Next event in the chain after this one, or `null` if
     * there is as yet no next event.
     */
    this._nextNow = null;

    /**
     * {Promise<ChainedEvent>|null} Promise for the next event in the chain
     * after this one, or `null` if there are no pending requests for same.
     */
    this._nextProm = null;

    /**
     * {function|null} Resolver for `_nextProm`. Set to non-`null` whenever
     * `_nextProm` is also non-`null`.
     */
    this._nextResolver = null;

    Object.seal(this);
  }

  /** {Functor} Event payload (name and arguments). */
  get payload() {
    return this._payload;
  }

  /**
   * {Promise<ChainedEvent>} Promise for the next event in the chain after this
   * instance, which becomes resolved once it is available.
   */
  get next() {
    if (this._nextNow !== null) {
      return Promise.resolve(this._nextNow);
    }

    // This event is currently at the tail of the chain, so the result will be
    // an unresolved promise.

    if (this._nextProm === null) {
      // First time `next` has been called; need to set up the promise and
      // resolver.
      this._nextProm = new Promise((resolve) => {
        this._nextResolver = resolve;
      });
    }

    return this._nextProm;
  }

  /**
   * {ChainedEvent|null} The next event in the chain after this instance if it
   * is immediately available, or `null` if there is not yet a next event.
   */
  get nextNow() {
    return this._nextNow;
  }

  /**
   * Gets the earliest event of the indicated name in the event chain, starting
   * at (and possibly including) this instance. This method only returns once a
   * matching event is available.
   *
   * @param {string} eventName Event name of interest.
   * @returns {ChainedEvent} The earliest event with the indidated name,
   *   starting at this instance.
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
   * @returns {ChainedEvent|null} The earliest immediately-available event with
   *   the indidated name, starting at this instance; or `null` if there is no
   *   such event.
   */
  earliestOfNow(eventName) {
    for (let e = this; e !== null; e = e.nextNow) {
      if (e.payload.name === eventName) {
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
   * @returns {ChainedEvent|null} The latest immediately-available event with
   *   the indidated name, starting at this instance; or `null` if there is no
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
   * @returns {ChainedEvent|null} The latest immediately-available event with
   *   the indidated name, starting at this instance; or `null` if there is no
   *   such event.
   */
  latestOfNow(eventName) {
    let result = null;

    for (let e = this; e !== null; e = e.nextNow) {
      if (e.payload.name === eventName) {
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
   * @returns {ChainedEvent} The next event with the indidated name, once it has
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
   * @returns {ChainedEvent|null} The next event with the indidated name that
   *   has already been resolved, or `null` if there is no such event.
   */
  nextOfNow(eventName) {
    const nextNow = this.nextNow;
    return (nextNow === null) ? null : nextNow.earliestOfNow(eventName);
  }

  /**
   * Constructs a new event which is set up to be at the head of an event chain
   * which continues with _this_ instance's next event, but with a different
   * event payload. Put another way, this constructs a replacement event for
   * this instance, but with the same chaining.
   *
   * @param {Functor} payload Event payload (name and arguments).
   * @returns {ChainedEvent} New event instance with the given `payload`, and
   *   whose `next` and `nextNow` behave the same as this instance's properties
   *   of the same names.
   */
  withNewPayload(payload) {
    const result = new ChainedEvent(this._source, payload);

    if (this._nextNow) {
      // This instance already knows its next event, so set up the result with
      // the same one.
      result._resolveNext(this._nextNow);
    } else {
      // This instance is at the tail of the event chain. Wait for its `next`,
      // and propagate that to the result.
      (async () => {
        result._resolveNext(await this.next);
      })();
    }

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
   * @returns {ChainedEvent} New event instance with `payload` properties, and
   *   whose `next` and `nextNow` refer to this instance.
   */
  withPushedHead(payload = new Functor('none')) {
    const result = new ChainedEvent(this._source, payload);

    result._resolveNext(this);
    return result;
  }

  /**
   * Resolves (hooks up) the given event as next event in the chain from this
   * instance. The event must have the same `source` as this one.
   *
   * **Note:** This method is marked "private" but is in effect "protected." It
   * is called by {@link EventSource}.
   *
   * @param {ChainedEvent} event Event to hook up.
   */
  _resolveNext(event) {
    ChainedEvent.check(event);
    if (this._source !== event._source) {
      throw Errors.badUse('Mismatched `event` source.');
    }

    if (this._nextNow !== null) {
      throw Errors.badUse('Can only call `_resolveNext()` once.');
    }

    this._nextNow = event;

    if (this._nextResolver !== null) {
      // There have already been one or more calls to `.next`, so we need to
      // resolve the promise that those calls returned. After that, there is no
      // longer a need to keep the promise and resolver around, so `null` them
      // out.
      this._nextResolver(event);
      this._nextResolver = null;
      this._nextProm     = null;
    }
  }
}
