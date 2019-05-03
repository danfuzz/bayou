// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { QuillEvents, QuillUtil } from '@bayou/quill-util';
import { CommonBase, Errors } from '@bayou/util-common';

/**
 * Plumbing between the title field (managed by Quill) on the client and the
 * document model (specifically a `title` property) on the server.
 */
export class TitleClient extends CommonBase {
  /**
   * Constructs an instance. The constructed instance expects to be the primary
   * non-human controller of the Quill instance it manages.
   *
   * @param {EditorComplex} editorComplex The editor complex which this instance
   *   is associated with.
   * @param {QuillProm} quill Quill editor instance for the title.
   */
  constructor(editorComplex) {
    super();

    /**
     * {EditorComplex} The editor complex which this instance is associated
     * with.
     */
    this._editorComplex = editorComplex;

    /** {Quill} Editor object. */
    this._quill = editorComplex.titleQuill;

    /** {DocSession} Server session control / manager. */
    this._docSession = editorComplex.docSession;

    /** {Logger} Logger specific to this client's session. */
    this._log = this._docSession.log;

    /** {PropertyClient} Property data communication handler. */
    this._propertyClient = this._docSession.propertyClient;
  }

  /**
   * Starts handling bidirectional updates.
   */
  async start() {
    // Start noticing when the local client changes the title.
    this._syncLoop();
  }

  /**
   * Handles "blur" events when done on a title field.
   *
   * @param {FocusEvent} event_unused Event object.
   */
  titleOnBlur(event_unused) {
    this._pushUpdate();
  }

  /**
   * Handles "enter" key events when done on a title field.
   *
   * @param {object} metaKeys_unused Plain object indicating which meta keys are
   *   active.
   * @returns {boolean} `false`, always, which tells Quill to stop processing.
   */
  titleOnEnter(metaKeys_unused) {
    this._pushUpdate();

    // Move focus to the body.
    const div = QuillUtil.editorDiv(this._editorComplex.bodyQuill);
    div.focus();

    return false;
  }

  /** {string} Current Quill title field contents. */
  get _quillContents() {
    // **TODO:** This should be a call to `getContents()` so we have a marked-up
    // delta and not just flat text.
    return this._quill.getText();
  }

  /** @param {string} string New Quill title field contents. */
  set _quillContents(string) {
    // **TODO:** This should be a call to `setContents()` so we have a marked-up
    // delta and not just flat text.
    return this._quill.setText(string);
  }

  /**
   * Loop which synchronizes the title between Quill and the server.
   *
   * **TODO:** This very likely wants to use {@link StateMachine}. As it stands,
   * the interactions between the pieces are confusing and surprising, and a
   * carefully thought-out state machine might help make things more
   * understandable.
   */
  async _syncLoop() {
    let currentEvent = this._quill.currentEvent;

    for (;;) {
      const currentContents = this._quillContents;

      if (this._quill.getSelection() === null) {
        // The title field doesn't have focus, so we should wait for changes
        // coming from the server, but also stop waiting should the selection
        // change (meaning that the title field probably got focus). What's
        // going on here is that we wrap each of the two possible calls in a
        // result object that lets us trivially distinguish which one happened.
        const got = await Promise.race([
          (async () => {
            const event = await currentEvent.nextOf(QuillEvents.TYPE_selectionChange);
            return { event };
          })(),
          (async () => {
            try {
              const value =
                await this._docSession.propertyClient.getUpdate('title', currentContents);
              return { value };
            } catch (e) {
              // A timeout will just elicit a retry. Everything else is a
              // throw-worthy problem.
              if (Errors.is_timedOut(e)) {
                return {}; // ...so that neither `if` clause below will activate.
              }
              throw e;
            }
          })()
        ]);

        const { event, value } = got;
        if (value !== undefined) {
          this._quill.setText(value);
          await this._pushUpdate();
        } else if (event !== undefined) {
          currentEvent = event;
        }
      } else {
        // The title field has focus. Wait for it to lose focus, then grab the
        // contents and push it as an update.
        const event     = await currentEvent.nextOf(QuillEvents.TYPE_selectionChange);
        const { range } = QuillEvents.propsOf(event);
        if (range === null) {
          await this._pushUpdate();
        }
        currentEvent = event;
      }
    }
  }

  /**
   * Performs a push of the local title state to the server.
   */
  async _pushUpdate() {
    const text = this._quillContents;

    // **TODO:** Probably want to handle exceptions from this call.
    await this._docSession.propertyClient.set('title', text);
  }
}
