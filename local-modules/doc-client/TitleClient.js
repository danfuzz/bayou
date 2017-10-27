// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { DocumentState } from 'data-model-client';
import { QuillEvents, QuillUtil } from 'quill-util';
import { CommonBase } from 'util-common';

/**
 * Plumbing between the title field (managed by Quill) on the client and the
 * document model (specifically a `title` property) on the server.
 */
export default class TitleClient extends CommonBase {
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
    // **TODO:** Needs to be implemented nontrivially. This just gets a snapshot
    // of the property at start time and never listens for updates coming from
    // the server.
    const initialValue = await this._propertyClient.get('title');
    this._quill.setText(initialValue);
    this._pushUpdate();

    // Start noticing when the local client changes the title.
    this._pusherLoop();
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

  /**
   * Loop which listens for events indicating that the title Quill lost focus,
   * using them to drive updates.
   */
  async _pusherLoop() {
    let currentEvent = this._quill.currentEvent;

    for (;;) {
      const event = await currentEvent.nextOf(QuillEvents.SELECTION_CHANGE);

      // We check to see if the title `<div>` has focus or not. Ideally, the
      // Quill event in which focus is lost would reflect that (e.g. with a
      // `null` selection), but that doesn't happen in practice.
      const div = QuillUtil.editorDiv(this._quill);
      if (div !== div.ownerDocument.activeElement) {
        this._pushUpdate();
      }

      currentEvent = event;
    }
  }

  /**
   * Performs a push of the local title state to Redux and to the server.
   */
  _pushUpdate() {
    // **TODO:** This should be a call to `getContents()` so we have a marked-up
    // delta and not just flat text.
    const text = this._quill.getText();

    // **TODO:** This is an async call, and its response (which could be an
    // exception) needs to be handled.
    this._docSession.propertyClient.set('title', text);

    // Update the Redux store.
    const store  = this._editorComplex.clientStore;
    const action = DocumentState.setTitleAction(text);
    store.dispatch(action);
  }
}
