// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Caret } from 'doc-common';
import { QuillEvent, QuillGeometry } from 'quill-util';
import { TObject, TString } from 'typecheck';
import { PromDelay } from 'util-common';

/**
 * {Int} Amount of time (in msec) to wait after receiving a caret update from
 * the server before requesting another one. This is to prevent the client from
 * inundating the server with requests when there is some particularly active
 * editing going on.
 */
const REQUEST_DELAY_MSEC = 250;

/**
 * {Int} Amount of time (in msec) to wait after noticing a local edit before
 * looking for a new one.
 */
const LOCAL_EDIT_DELAY_MSEC = 1000;

/**
 * {Int} Amount of time (in msec) to wait after a failure to communicate with
 * the server, before trying to reconnect.
 */
const ERROR_DELAY_MSEC = 5000;

/**
 * Manager of the visual display of the selection and insertion caret of remote
 * users editing the same document as the local user. It renders the selections
 * into an SVG element that overlays the Quill editor.
 */
export default class CaretOverlay {
  /**
   * Constructs an instance.
   *
   * @param {EditorComplex} editorComplex Editor complex that this instance is
   *   a part of.
   * @param {Element} svgElement The `<svg>` element to attach to.
   */
  constructor(editorComplex, svgElement) {
    /**
     * {Map<string, Map<string, object>>} _Ad hoc_ storage for arbitrary data
     * associated with sessions (highlights, color, avatar, etc).
     */
    this._sessions = new Map();

    /** {EditorComplex} Editor complex that this instance is a part of. */
    this._editorComplex = editorComplex;

    /** {Document} The HTML document hosting our annotations. */
    this._document = TObject.check(svgElement.ownerDocument, Document);

    /**
     * {Element} The SVG element in which we render the remote carets. The SVG
     * should be the same dimensions as
     * `_editorComplex.quill.scrollingContainer` and on top of it in z-index
     * order (closer to the viewer).
     */
    this._overlay = TObject.check(svgElement, Element);

    this._watchCarets();
    this._watchLocalEdits();
  }

  /**
   * Begin tracking a new session.
   *
   * @param {Caret} caret The new caret to track (which includes a session ID).
   */
  _beginSession(caret) {
    Caret.check(caret);

    // **TODO:** Things will probably be easier if we just store `caret`
    // directly in the map.
    this._sessions.set(caret.sessionId, new Map());
  }

  /**
   * Stop tracking a given session.
   *
   * @param {string} sessionId The session to stop tracking.
   */
  _endSession(sessionId) {
    TString.check(sessionId);

    this._sessions.delete(sessionId);
    this._updateDisplay();
  }

  /**
   * Updates annotation for a remote session's caret, and updates the display.
   *
   * @param {Caret} caret The caret to update.
   */
  _updateCaret(caret) {
    Caret.check(caret);

    const sessionId = caret.sessionId;

    if (!this._sessions.has(sessionId)) {
      this._beginSession(caret);
    }

    const info = this._sessions.get(sessionId);

    // **TODO:** Things will probably be easier if we just store `caret`
    // directly in the map.
    info.set('selection', { index: caret.index, length: caret.length });
    info.set('color', caret.color);

    this._updateDisplay();
  }

  /**
   * Watches for selection-related activity.
   */
  async _watchCarets() {
    await this._editorComplex.whenReady();

    // Change `false` to `true` here if you want to see the local user's
    // selection get highlighted. Handy during development!
    if (false) { // eslint-disable-line no-constant-condition
      let currentEvent = this._editorComplex.quill.currentEvent;
      while (currentEvent) {
        const selEvent = await currentEvent.nextOf(QuillEvent.SELECTION_CHANGE);
        const range    = selEvent.range;

        this._updateCaret(
          new Caret('local-session',
            { index: range.index, length: range.length, color: '#ffb8b8' }));
        currentEvent = selEvent;
      }
    }

    let docSession = null;
    let snapshot = null;
    let sessionProxy;
    let sessionId;

    for (;;) {
      if (docSession === null) {
        // Init the session variables (on the first iteration), or re-init them
        // if we got a failure during a previous iteration.
        docSession   = this._editorComplex.docSession;
        sessionProxy = await docSession.getSessionProxy();

        // Can only get the session ID after we have a proxy. (Before that, the
        // ID might not be set, because the session might not even exist!)
        sessionId = this._editorComplex.sessionId;
      }

      try {
        if (snapshot !== null) {
          // We have a snapshot which we can presumably get a delta from, so try
          // to do that.
          const delta = await sessionProxy.caretDeltaAfter(snapshot.revNum);
          snapshot = snapshot.compose(delta);
          docSession.log.detail(`Got caret delta. ${snapshot.carets.length} caret(s).`);
        }
      } catch (e) {
        // Assume that the error isn't truly fatal. Most likely, it's because
        // the session got restarted or because the snapshot we have is too old
        // to get a delta from. We just `null` out the snapshot and let the next
        // clause try to get it afresh.
        docSession.log.warn('Trouble with `caretDeltaAfter`:', e);
        snapshot = null;
      }

      try {
        if (snapshot === null) {
          // We don't yet have a snapshot to base deltas off of, so get one!
          // This can happen either because we've just started a new session or
          // because the attempt to get a delta failed for some reason. (The
          // latter is why this section isn't just part of an `else` block to
          // the previous `if`).
          snapshot = await sessionProxy.caretSnapshot();
          docSession.log.detail(`Got ${snapshot.carets.length} new caret(s)!`);
        }
      } catch (e) {
        // Assume that the error is transient and most likely due to the session
        // getting terminated / restarted. Null out the session variables, wait
        // a moment, and try again.
        docSession.log.warn('Trouble with `caretSnapshot`:', e);
        docSession   = null;
        sessionProxy = null;
        await PromDelay.resolve(ERROR_DELAY_MSEC);
        continue;
      }

      const oldSessions = new Set(this._sessions.keys());

      for (const c of snapshot.carets) {
        if (c.sessionId === sessionId) {
          // Don't render the caret for this client.
          continue;
        }

        this._updateCaret(c);
        oldSessions.delete(c.sessionId);
      }

      // The remaining elements of `oldSessions` are sessions which have gone
      // away.
      for (const s of oldSessions) {
        docSession.log.info(`Session ended: ${s}`);
        this._endSession(s);
      }

      await PromDelay.resolve(REQUEST_DELAY_MSEC);
    }
  }

  /**
   * Watches the local editor for edits. When noticed, causes the display to
   * update. Much of the time, this will be a no-op because the caret activity
   * will have already caused an update. However, some edits won't actually
   * affect carets (notably, style-only changes), and this method effectively
   * provides a backstop that prevents those edits from causing lingering
   * inaccuracy in the overlay.
   */
  async _watchLocalEdits() {
    const log = this._editorComplex.log;
    let currentEvent = this._editorComplex.quill.currentEvent;

    for (;;) {
      // Wait for a text change.
      currentEvent = await currentEvent.nextOf(QuillEvent.TEXT_CHANGE);

      // Skip any additional text changes that have already been posted, so that
      // we won't just be slowly iterating over all changes.
      currentEvent = currentEvent.latestOfNow(QuillEvent.TEXT_CHANGE);

      log.detail('Got local edit event.');
      this._updateDisplay();

      // Wait a moment, before looking for more changes. If there are multiple
      // changes during this time, the `latestOfNow()` call above will elide
      // them.
      await PromDelay.resolve(LOCAL_EDIT_DELAY_MSEC);
    }
  }

  /**
   * Redraws the current state of the remote carets.
   */
  _updateDisplay() {
    // Remove extant annotations.
    while (this._overlay.firstChild) {
      this._overlay.removeChild(this._overlay.firstChild);
    }

    const quill = this._editorComplex.quill;

    // For each session…
    for (const [sessionId_unused, info] of this._sessions) {
      const selection = info.get('selection');

      if (selection.length === 0) {
        const rect = QuillGeometry.boundsForCursorAtOffset(quill, selection.index);

        const pathCommand = QuillGeometry.svgPathCommandsForRect(rect);
        const path = this._document.createElementNS('http://www.w3.org/2000/svg', 'path');

        path.setAttribute('d', pathCommand);
        path.setAttribute('fill', info.get('color'));
        path.setAttribute('fill-opacity', '1.0');
        path.setAttribute('stroke-width', '1.0');
        path.setAttribute('stroke', info.get('color'));
        path.setAttribute('stroke-opacity', '1.0');

        this._overlay.appendChild(path);
      } else {
        // Generate a list of rectangles representing their selection…
        let rects = QuillGeometry.boundsForLinesInRange(quill, selection);

        rects = rects.map(QuillGeometry.snapRectToPixels);

        for (const rect of rects) {
          const svgRect = this._document.createElementNS('http://www.w3.org/2000/svg', 'rect');

          svgRect.setAttribute('x', rect.left);
          svgRect.setAttribute('y', rect.top);
          svgRect.setAttribute('width', rect.width);
          svgRect.setAttribute('height', rect.height);
          svgRect.setAttribute('rx', 3);
          svgRect.setAttribute('ry', 3);
          svgRect.setAttribute('fill', info.get('color'));
          svgRect.setAttribute('fill-opacity', '0.50');
          svgRect.setAttribute('stroke-width', '1.0');
          svgRect.setAttribute('stroke', info.get('color'));
          svgRect.setAttribute('stroke-opacity', '1.0');

          this._overlay.appendChild(svgRect);
        }
      }
    }
  }
}
