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
    const origEmitter = this.emitter;
    const Emitter = origEmitter.constructor;
    const API = Emitter.sources.API;
    const EDITOR_CHANGE = Emitter.events.EDITOR_CHANGE;
    const TEXT_CHANGE = Emitter.events.TEXT_CHANGE;

    // Key used to authenticate this instance to the event chain it spawns.
    // **Not** exposed as an instance variable, as doing so would violate the
    // security we are trying to establish by the key's existence in the first
    // place!
    const accessKey = Object.freeze(['quill-prom-key']);

    /**
     * {DeltaEvent} The most recent resolved event. It is initialized as defined
     * by the documentation for `currentChange`.
     */
    this._currentChange = new DeltaEvent(
      accessKey, FrozenDelta.EMPTY, FrozenDelta.EMPTY, API);

    // We override `emitter.emit()` to _synchronously_ add an event to the
    // promise chain. We do it this way instead of relying on an event callback
    // to avoid the possibility of Quill's document state advancing between the
    // time that an event callback is queued and when it is fired. That is,
    // when an event callback is running, it is not safe for it to assume that
    // Quill's synchronously accessible state is consistent with the world
    // portrayed to the callback by the event; that is, it might already be
    // out-of-date. There are two main ways this inconsistency can happen: (1)
    // The user happens to be actively (and perhaps furiously) editing the
    // document. (2) Some event handler that gets run earlier for the same
    // change performs edits on the document.
    //
    // Neither of these cases has an impact here, specifically because this
    // method gets to run synchronously with the queueing of each event. That
    // is, by construction, as of the end of the call to `emit()` the event
    // promise chain will always fully and accurately represent the synchronous
    // document state.
    //
    // Why is this a good thing? Because when an event chain consumer gets
    // activated for an earlier event, it will be able to synchronously "walk"
    // its way to the latest state and so never be in a position of acting
    // synchronously on stale information.
    const origEmit = origEmitter.emit;
    origEmitter.emit = (type, arg0, ...rest) => {
      if ((type === EDITOR_CHANGE) && (arg0 === TEXT_CHANGE)) {
        // We attach to the `EDITOR_CHANGE` event when the subtype is
        // `TEXT_CHANGE`. This isn't exposed Quill API, but in the current
        // implementation (as of this writing) implementation, Quill
        // consistently emits an `EDITOR_CHANGE(TEXT_CHANGE, ...)` event for
        // each text change, even when it doesn't emit a `TEXT_CHANGE` event
        // (e.g., when the change marked as "silent"). We, on the other hand,
        // truly need the full set of all changes in order, since otherwise
        // the document state as known to the server would get out of synch with
        // what is portrayed to the user.
        this._currentChange =
          this._currentChange._gotChange(accessKey, ...rest);
      }

      // This is the moral equivalent of `super.emit(...)`.
      origEmit.call(origEmitter, type, arg0, ...rest);
    };
  }

  /**
   * {DeltaEvent} The current (latest / most recent) document change that has
   * been made to this instance. It is always a regular value (not a promise).
   *
   * **Note:** If accessed before any changes have ever been made to this
   * instance, `delta` and `oldContents` are both empty deltas.
   */
  get currentChange() {
    return this._currentChange;
  }
}
