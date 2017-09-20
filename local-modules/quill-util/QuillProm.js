// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Quill from 'quill';

import { EventSource } from 'promise-util';
import { TObject } from 'typecheck';
import { CommonBase, Functor } from 'util-common';

import QuillEvents from './QuillEvents';

/**
 * Extension of the `Quill` class that provides a promise-based interface to
 * get at events.
 *
 * **Note:** This class mixes in `CommonBase` to get the usual typechecking
 * functionality.
 */
export default class QuillProm extends Quill {
  /**
   * Constructs an instance. Parameters are identical to the normal `Quill`
   * constructor (see which).
   *
   * @param {Element} domNode The DOM node that the instance gets attached to.
   * @param {...*} constructArgs The rest of the Quill constructor arguments.
   */
  constructor(domNode, ...constructArgs) {
    super(domNode, ...constructArgs);

    /** {Element} The DOM node that this instance is attached to. */
    this._domNode = TObject.check(domNode, Element);

    // We can't safely `import Emitter`, as it's not an exposed class, so we
    // instead get at it via the instance of it made in the superclass
    // constructor.
    const origEmitter = this.emitter;

    /** {EventSource} Event source (emitter) for this instance. */
    this._emitter = new EventSource();

    /**
     * {ChainableEvent} The most recent resolved event. It is initialized as
     * defined by the documentation for `currentEvent`.
     */
    this._currentEvent = this._emitter.emit(QuillEvents.EMPTY_TEXT_CHANGE_PAYLOAD);

    // We override `emitter.emit()` to _synchronously_ emit an event to the
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
    origEmitter.emit = (type, ...rest) => {
      if (type === QuillEvents.EDITOR_CHANGE) {
        // We attach to the `editor-change` event so that we see all changes in
        // their original order, even when changes were made with the "silent"
        // flag (because if we miss events, then the local and server state will
        // tragically diverge).

        this._currentEvent =
          QuillEvents.emitQuillPayload(this._emitter, new Functor(...rest));
      }

      // This is the moral equivalent of `super.emit(...)`.
      origEmit.call(origEmitter, type, ...rest);
    };
  }

  /** {Element} The DOM node that this instance is attached to. */
  get domNode() {
    return this._domNode;
  }

  /**
   * {ChainableEvent} The current (latest / most recent) event that has been
   * emitted from this instance. It is always a regular value (not a promise).
   *
   * **Note:** If accessed before any events have ever been emitted from this
   * instance, this is what amounts to an empty `text-change` event with `api`
   * source.
   */
  get currentEvent() {
    return this._currentEvent;
  }
}

CommonBase.mixInto(QuillProm);
