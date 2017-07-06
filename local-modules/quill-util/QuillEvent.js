// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { FrozenDelta } from 'doc-common';
import { TObject, TString } from 'typecheck';

/**
 * Event wrapper for a Quill Delta, including reference to the document source,
 * the old contents, and the chain of subsequent events. It defines the
 * following properties:
 *
 * * `delta` -- Same as with `text-change` events.
 * * `oldContents` -- Same as with `text-change` events.
 * * `source`  -- Same as with `text-change` events.
 * * `next` -- A promise for the very next change (in order). You can use this
 *   to iterate over changes as they continue to happen.
 * * `nextNow` -- The next change after this one as a regular object (not a
 *   promise), but only if it is already available. You can use this to
 *   synchronously iterate up to the current (latest) change, and know if in
 *   fact the change you are looking at is the current one (because `nextNow`
 *   will be `null` until the next change actually happens).
 *
 * Instances of this class are always frozen (read-only) to help protect clients
 * from each other (or from inadvertently messing with themselves).
 */
export default class QuillEvent {
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
   * @param {string} source The name of the notional "source" of the event.
   *   (Typical values are `api` and `user`.)
   * @param {string} eventName Name of event (its type, really). Indicates how
   *   the rest of the arguments are interpreted.
   * @param {...*} eventArgs Additional event arguments, depending on the event
   *   name. Arguments are all as documented by Quill, except that `source`
   *   isn't present in these because it was already separately passed (see
   *   above).
   */
  constructor(accessKey, source, eventName, ...eventArgs) {
    /** {String} The event source. */
    this.source = TString.check(source);

    /** {String} The event name (its type, really). */
    this.eventName = TString.check(eventName);

    switch (eventName) {
      case QuillEvent.TEXT_CHANGE: {
        const [delta, oldContents] = eventArgs;

        /** {FrozenDelta} The change to the text, per se. */
        this.delta = FrozenDelta.coerce(delta);

        /** {FrozenDelta} The text as of just before the change. */
        this.oldContents = FrozenDelta.coerce(oldContents);

        break;
      }

      case QuillEvent.SELECTION_CHANGE: {
        let [range, oldRange] = eventArgs;

        // Validate the ranges, and freeze them if they're objects.
        if (range !== null) {
          range = Object.freeze(TObject.withExactKeys(range, ['index', 'length']));
        }
        if (oldRange !== null) {
          oldRange = Object.freeze(TObject.withExactKeys(range, ['index', 'length']));
        }

        /** {object|null} The new selection range. */
        this.range = range;

        /** {object|null} The immediately-prior selection range. */
        this.oldRange = oldRange;

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
    this.next = Object.seal(
      new Promise((res, rej_unused) => { resolveNext = res; }));

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

    // Likewise, this is how we can provide a read-only yet changeable `nextNow`
    // on a frozen object.
    Object.defineProperty(this, 'nextNow', { get: () => { return nextNow; } });

    Object.freeze(this);
  }

  /**
   * Gets the next event of the indicated name, whenever it becomes resolved.
   *
   * @param {string} eventName Event name of interest.
   * @returns {QuillEvent} The next event with the indidated name, once it has
   *   become resolved.
   */
  async nextOf(eventName) {
    for (let e = await this.next; e !== null; e = await e.next) {
      if (e.eventName === eventName) {
        return e;
      }
    }

    return null;
  }

  /**
   * Gets the next event of the indicated name, if it is immediately available.
   *
   * @param {string} eventName Event name of interest.
   * @returns {QuillEvent|null} The next event with the indidated name that has
   *   already been resolved, or `null` if there is no such event.
   */
  nextNowOf(eventName) {
    for (let e = this.nextNow; e !== null; e = e.nextNow) {
      if (e.eventName === eventName) {
        return e;
      }
    }

    return null;
  }
}
