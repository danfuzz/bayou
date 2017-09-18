// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { FrozenDelta } from 'doc-common';
import { TInt, TObject, TString } from 'typecheck';
import { Errors, Functor } from 'util-common';

import BaseEvent from './BaseEvent';

/**
 * Event wrapper for events coming from Quill, as part of a promise-based event
 * chain.
 *
 * Instances of this class are always frozen (read-only) to help protect clients
 * from each other (or from inadvertently messing with themselves).
 */
export default class QuillEvent extends BaseEvent {
  /** {String} Event source for the API. */
  static get API() {
    return 'api';
  }

  /** {String} Event name for editor change events. */
  static get EDITOR_CHANGE() {
    return 'editor-change';
  }

  /** {String} Event name for selection change events. */
  static get SELECTION_CHANGE() {
    return 'selection-change';
  }

  /** {String} Event name for text change events. */
  static get TEXT_CHANGE() {
    return 'text-change';
  }

  /**
   * "Fixes" and validates the given event payload. The fixing takes into
   * account the fact that Quill will produce events with non-immutable data.
   *
   * @param {Functor} payload Event payload in question.
   * @returns {Functor} Fixed payload.
   */
  static fixPayload(payload) {
    Functor.check(payload);
    const name = payload.name;

    switch (name) {
      case QuillEvent.TEXT_CHANGE: {
        const [delta, oldContents, source] = payload.args;
        return new Functor(name,
          FrozenDelta.coerce(delta),
          FrozenDelta.coerce(oldContents),
          TString.check(source));
      }

      case QuillEvent.SELECTION_CHANGE: {
        const [range, oldRange, source] = payload.args;
        return new Functor(name,
          QuillEvent._checkAndFreezeRange(range),
          QuillEvent._checkAndFreezeRange(oldRange),
          TString.check(source));
      }

      default: {
        throw Errors.bad_value(payload, 'Quill event payload');
      }
    }
  }

  /**
   * Gets the payload of the given event or event payload as an object with
   * named properties.
   *
   * @param {BaseEvent|Functor} eventOrPayload Event or event payload in
   *   question.
   * @returns {object} The properties of `event`'s payload, in convenient named
   *   form.
   */
  static propsOf(eventOrPayload) {
    const payload = (eventOrPayload instanceof Functor)
      ? eventOrPayload
      : eventOrPayload.payload;
    const name = payload.name;

    switch (name) {
      case QuillEvent.TEXT_CHANGE: {
        const [delta, oldContents, source] = payload.args;
        return { name, delta, oldContents, source };
      }

      case QuillEvent.SELECTION_CHANGE: {
        const [range, oldRange, source] = payload.args;
        return { name, range, oldRange, source };
      }

      default: {
        throw Errors.bad_value(payload, 'Quill event payload');
      }
    }
  }

  /**
   * Constructs an instance.
   *
   * @param {object} accessKey Key which protects ability to resolve the next
   *   event.
   * @param {Functor} payload Event payload (name and arguments).
   */
  constructor(accessKey, payload) {
    super(QuillEvent.fixPayload(payload));

    // **Note:** `accessKey` is _not_ exposed as a property. Doing so would
    // cause the security problem that its existence is meant to prevent. That
    // is, this arrangement means that we know client code won't be able to
    // mess with the promise chain.

    // The resolver function for the `next` promise. Used in `_gotEvent()`
    // below.
    let resolveNext;

    // The resolved value for `next`. Used in `_gotEvent` and `nextNow` below.
    let nextNow = null;

    // **Note:** Ideally, we would `Object.freeze()` the promise, to avoid a
    // potential "sneaky" source of state leakage. Unfortunately, the `core-js`
    // "polyfill" for `Promise` (which is needed when running in Safari as of
    // this writing) modifies the `Promise` objects it creates, so freezing them
    // would cause trouble. Instead, we do the next-safest thing, which is
    // `seal()`ing the promise. This doesn't prevent existing properties from
    // being changed, but it does prevent properties from being reconfigured
    // (including disallowing adding and removing properties).
    const next =
      Object.seal(new Promise((res, rej_unused) => { resolveNext = res; }));

    // This method is defined inside the constructor so that we can use the
    // lexical context for (what amount to) private instance variables.
    this._gotEvent = Object.freeze((key, ...args) => {
      if (key !== accessKey) {
        // See note toward the top of this function.
        throw Errors.bad_use('Invalid access.');
      }

      nextNow = new QuillEvent(key, new Functor(...args));

      resolveNext(nextNow);
      return nextNow;
    });

    // Define the two properties that are required by the superclass.
    Object.defineProperties(this, {
      next:    { get: () => { return next;    } },
      nextNow: { get: () => { return nextNow; } }
    });

    Object.freeze(this);
  }

  /**
   * Validates a "range" object as provided by Quill. This accepts `null` as
   * a valid value. If the range is valid and non-`null`, freezes it.
   *
   * @param {*} range The (alleged) range.
   * @returns {object} The validated range.
   */
  static _checkAndFreezeRange(range) {
    if (range !== null) {
      TObject.withExactKeys(range, ['index', 'length']);
      TInt.nonNegative(range.index);
      TInt.nonNegative(range.length);
      Object.freeze(range);
    }

    return range;
  }
}
