// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { FrozenDelta } from 'doc-common';
import { TInt, TObject, TString } from 'typecheck';

import BaseEvent from './BaseEvent';

/**
 * Event wrapper for a Quill Delta, including reference to the document source,
 * the old contents, and the chain of subsequent events. In addition to the
 * event chain properties, each instance has properties as defined by Quill,
 * with the same names as Quill indicates.
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
   * Constructs an instance.
   *
   * @param {object} accessKey Key which protects ability to resolve the next
   *   event.
   * @param {string} eventName Name of event (its type, really). Indicates how
   *   the rest of the arguments are interpreted.
   * @param {...*} eventArgs Additional event arguments, depending on the event
   *   name. Arguments are all as documented by Quill, except that `source`
   *   isn't present in these because it was already separately passed (see
   *   above).
   */
  constructor(accessKey, eventName, ...eventArgs) {
    super(eventName);

    switch (eventName) {
      case QuillEvent.TEXT_CHANGE: {
        const [delta, oldContents, source] = eventArgs;

        /** {FrozenDelta} The change to the text, per se. */
        this.delta = FrozenDelta.coerce(delta);

        /** {FrozenDelta} The text as of just before the change. */
        this.oldContents = FrozenDelta.coerce(oldContents);

        /** {String} The event source. */
        this.source = TString.check(source);

        break;
      }

      case QuillEvent.SELECTION_CHANGE: {
        const [range, oldRange, source] = eventArgs;

        /** {object|null} The new selection range. */
        this.range = QuillEvent._checkAndFreezeRange(range);

        /** {object|null} The immediately-prior selection range. */
        this.oldRange = QuillEvent._checkAndFreezeRange(oldRange);

        /** {String} The event source. */
        this.source = TString.check(source);

        break;
      }

      default: {
        throw new Error(`Unrecognized event name: ${eventName}`);
      }
    }

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
        throw new Error('Invalid access.');
      }

      nextNow = new QuillEvent(key, ...args);

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
      TInt.min(range.index, 0);
      TInt.min(range.length, 0);
      Object.freeze(range);
    }

    return range;
  }
}
