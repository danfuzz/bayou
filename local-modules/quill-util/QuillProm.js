// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Quill from 'quill';

import { FrozenDelta } from 'doc-common';

import DeltaEvent from './DeltaEvent';

/**
 * Extension of the `Quill` class that provides a promise-based interface to
 * get at events.
 */
export default class QuillProm extends Quill {
  /**
   * Constructs an instance. Parameters are identical to the normal `Quill`
   * constructor (see which).
   */
  constructor(...constructArgs) {
    super(...constructArgs);

    // We can't safely `import Emitter`, as it's not an exposed class, so we
    // instead get at it via the instance of it made in the superclass
    // constructor.
    const Emitter = this.emitter.constructor;
    const API = Emitter.sources.API;
    const EDITOR_CHANGE = Emitter.events.EDITOR_CHANGE;
    const TEXT_CHANGE = Emitter.events.TEXT_CHANGE;

    // Key used to authenticate this instance to the event chain it spawns.
    // **Not** exposed as an instance variable, as doing so would violate the
    // security we are trying to establish by the key's existence in the first
    // place!
    const accessKey = Object.freeze(['quill-prom-key']);

    /**
     * The most recent resolved event. It is initialized as defined by the
     * documentation for `currentChange`.
     */
    this._currentChange = new DeltaEvent(
      accessKey, FrozenDelta.EMPTY, FrozenDelta.EMPTY, API);

    // We attach to the `EDITOR_CHANGE` event. This isn't exposed Quill API,
    // but in the current (as of this writing) implementation, Quill will emit
    // an `EDITOR_CHANGE` event synchronously _before_ emitting a `TEXT_CHANGE`
    // event. Quill also attaches a handler to this event, and importantly it
    // _does not_ ever alter the document content in response to the event.
    //
    // The upshot is that when we receive the event here, we can know for sure
    // that it is in order, because the only way out-of-order text change events
    // happen is when client code re-enters Quill to do document changes within
    // event handlers, which causes _subsequent_ handlers to see things out of
    // order. By construction, that can't happen to us here because we know
    // we're the first-added handler.
    this.emitter.on(EDITOR_CHANGE, (type, ...rest) => {
      if (type === TEXT_CHANGE) {
        this._currentChange =
          this._currentChange._gotChange(accessKey, ...rest);
      }
    });
  }

  /**
   * The current (latest / most recent) document change that has been made to
   * this instance. It is always a regular value (not a promise), in particular
   * an object with bindings as follows:
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
   * The value is always read-only to help protect clients from each other (or
   * from inadvertently messing with themselves).
   *
   * If accessed before any changes have ever been made to this instance,
   * `delta` and `oldContents` are both empty deltas.
   */
  get currentChange() {
    return this._currentChange;
  }
}
