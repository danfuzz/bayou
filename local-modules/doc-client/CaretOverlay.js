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
 * {string} XML namespace for SVG documents.
 */
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** {number} The target square dimension for user avatars. */
const AVATAR_DIMENSION = 20.0;

/**
 * {number} The avatar drawing code is done as though the dimension was
 * 400x400 (to make the numbers prettier). This value is the divisor needed
 * to scale it down to the target dimension for avatars.
 */
const AVATAR_SCALE_FACTOR = AVATAR_DIMENSION / 400.0;

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
     * {SVGSVGElement} The `<svg>` element in which we render the remote carets.
     * The SVG should be the same dimensions as
     * `_editorComplex.bodyQuill.scrollingContainer` and on top of it in z-index
     * order (closer to the viewer).
     * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/svg
     *
     * The structure of the overlay contents is roughly:
     *
     * ```
     * <svg>
     *   <defs>
     *     [reusuable elements such as clip paths, avatars, gradients, etc]
     *   </defs>
     *   [caret/selection drawing commands for session A]
     *   <use href="#avatarA" />
     *   [caret/selection drawing commands for session B]
     *   <use href="#avatarB" />
     *   [caret/selection drawing commands for session N]
     *   <use href="#avatarN" />
     * </svg>
     * ```
     */
    this._svgOverlay = TObject.check(svgElement, Element);

    /**
     * {SVGDefsElement} The `<defs>` element within `_svgOverlay`. This holds
     * reusable definitions such as clip paths, gradients, session avatars, etc.
     * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/defs
     */
    this._svgDefs = this._addInitialSvgDefs();

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

    const info = new Map(Object.entries({ caret }));

    this._sessions.set(caret.sessionId, info);
    this._addAvatarToDefs(info);
    this._updateDisplay();
  }

  /**
   * Stop tracking a given session.
   *
   * @param {string} sessionId The session to stop tracking.
   */
  _endSession(sessionId) {
    TString.check(sessionId);

    this._removeAvatarFromDefs(sessionId);
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

    const info     = this._sessions.get(sessionId);
    const oldCaret = info.get('caret');

    info.set('caret', caret);

    if (caret.color !== oldCaret.color) {
      this._updateAvatarColor(caret);
    }

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
      let currentEvent = this._editorComplex.bodyQuill.currentEvent;
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
   * affect caret data even though the rendered coordinates for carets would
   * change (notably, style-only changes), and this method effectively provides
   * a backstop that prevents those edits from causing lingering inaccuracy in
   * the rendered overlay.
   */
  async _watchLocalEdits() {
    const log = this._editorComplex.log;
    let currentEvent = this._editorComplex.bodyQuill.currentEvent;

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
    while (this._svgOverlay.firstChild) {
      this._svgOverlay.removeChild(this._svgOverlay.firstChild);
    }

    // Put back our pre-made definitions.
    this._svgOverlay.appendChild(this._svgDefs);

    const quill = this._editorComplex.bodyQuill;

    // For each session…
    for (const [sessionId_unused, info] of this._sessions) {
      const caret = info.get('caret');
      const avatarReference = info.get('avatarReference');

      if (caret.length === 0) {
        // Length of zero means an insertion point instead of a selection
        const rect = QuillGeometry.boundsForCursorAtOffset(quill, caret.index);

        const pathCommand = QuillGeometry.svgPathCommandsForRect(rect);
        const path = this._document.createElementNS(SVG_NAMESPACE, 'path');

        // Even for a zero-width rect we get what we expect when we stroke the frame.
        path.setAttribute('d', pathCommand);
        path.setAttribute('fill', caret.color);
        path.setAttribute('fill-opacity', '1.0');
        path.setAttribute('stroke-width', '1.0');
        path.setAttribute('stroke', caret.color);
        path.setAttribute('stroke-opacity', '1.0');

        this._svgOverlay.appendChild(path);

        const x = rect.left - (AVATAR_DIMENSION / 2.0);
        const y = rect.top - AVATAR_DIMENSION;

        avatarReference.setAttribute('transform', `translate(${x}, ${y})`);
        this._svgOverlay.appendChild(avatarReference);
      } else {
        // Generate a list of rectangles representing the selection.
        let rects = QuillGeometry.boundsForLinesInRange(quill, caret.index, caret.length);

        rects = rects.map(QuillGeometry.snapRectToPixels);

        for (const rect of rects) {
          const svgRect = this._document.createElementNS(SVG_NAMESPACE, 'rect');

          svgRect.setAttribute('x', rect.left);
          svgRect.setAttribute('y', rect.top);
          svgRect.setAttribute('width', rect.width);
          svgRect.setAttribute('height', rect.height);
          svgRect.setAttribute('rx', 3);
          svgRect.setAttribute('ry', 3);
          svgRect.setAttribute('fill', caret.color);
          svgRect.setAttribute('fill-opacity', '0.50');
          svgRect.setAttribute('stroke-width', '1.0');
          svgRect.setAttribute('stroke', caret.color);
          svgRect.setAttribute('stroke-opacity', '1.0');

          this._svgOverlay.appendChild(svgRect);

          const topLeft = QuillGeometry.boundsForCursorAtOffset(quill, caret.index);
          const x = topLeft.left - (AVATAR_DIMENSION / 2.0);
          const y = topLeft.top - AVATAR_DIMENSION;

          avatarReference.setAttribute('transform', `translate(${x}, ${y})`);
          this._svgOverlay.appendChild(avatarReference);
        }
      }
    }
  }

  _addInitialSvgDefs() {
    const defs = this._document.createElementNS(SVG_NAMESPACE, 'defs');

    // This is the outer clipping mask. This keeps the shoulders from extending
    // outside of the outer frame.
    const avatarClipPath = this._document.createElementNS(SVG_NAMESPACE, 'clipPath');

    avatarClipPath.setAttribute('id', 'avatarClipPath');

    const clippingCircle = this._document.createElementNS(SVG_NAMESPACE, 'circle');

    clippingCircle.setAttribute('cx', 200 * AVATAR_SCALE_FACTOR);
    clippingCircle.setAttribute('cy', 200 * AVATAR_SCALE_FACTOR);
    clippingCircle.setAttribute('r', 195 * AVATAR_SCALE_FACTOR);

    avatarClipPath.appendChild(clippingCircle);
    defs.appendChild(avatarClipPath);

    return defs;
  }

  /**
   * Constructs an avatar image for the session and adds it to the `<defs>`
   * section of the SVG.
   *
   * @param {Map<string, object>} info The metadata for this session.
   */
  _addAvatarToDefs(info) {
    const caret = info.get('caret');

    // The whole avatar is set in a group with a known id
    const avatarGroup = this._document.createElementNS(SVG_NAMESPACE, 'g');
    const sessionId = caret.sessionId;

    avatarGroup.setAttribute('id', CaretOverlay.avatarNameForSessionId(sessionId));

    // Add the circle that will hold the background color
    const backgroundCircle = this._document.createElementNS(SVG_NAMESPACE, 'circle');

    backgroundCircle.setAttribute('cx', 200 * AVATAR_SCALE_FACTOR);
    backgroundCircle.setAttribute('cy', 200 * AVATAR_SCALE_FACTOR);
    backgroundCircle.setAttribute('r', 195 * AVATAR_SCALE_FACTOR);
    backgroundCircle.setAttribute('fill', caret.color);
    backgroundCircle.classList.add('avatar-theme-color');

    // Create a new group to hold the head and shoulders and clip it to the mask we made earlier.
    const personGroup = this._document.createElementNS(SVG_NAMESPACE, 'g');

    personGroup.setAttribute('clip-path', 'url(#avatarClipPath)');

    const shoulders = this._document.createElementNS(SVG_NAMESPACE, 'ellipse');

    shoulders.setAttribute('cx', 200 * AVATAR_SCALE_FACTOR);
    shoulders.setAttribute('cy', 350 * AVATAR_SCALE_FACTOR);
    shoulders.setAttribute('rx', 180 * AVATAR_SCALE_FACTOR);
    shoulders.setAttribute('ry', 85 * AVATAR_SCALE_FACTOR);
    shoulders.setAttribute('fill', '#ffffff');
    shoulders.setAttribute('stroke', '#000000');
    shoulders.setAttribute('stroke-width', 1);

    const head = this._document.createElementNS(SVG_NAMESPACE, 'ellipse');

    head.setAttribute('cx', 200 * AVATAR_SCALE_FACTOR);
    head.setAttribute('cy', 190 * AVATAR_SCALE_FACTOR);
    head.setAttribute('rx', 96 * AVATAR_SCALE_FACTOR);
    head.setAttribute('ry', 108 * AVATAR_SCALE_FACTOR);
    head.setAttribute('fill', '#ffffff');
    head.setAttribute('stroke', '#000000');
    head.setAttribute('stroke-width', 1);

    // Add the black frame that goes around the whole thing.
    const frame = this._document.createElementNS(SVG_NAMESPACE, 'circle');

    frame.setAttribute('cx', 200 * AVATAR_SCALE_FACTOR);
    frame.setAttribute('cy', 200 * AVATAR_SCALE_FACTOR);
    frame.setAttribute('r', 195 * AVATAR_SCALE_FACTOR);
    frame.setAttribute('fill-opacity', 0);
    frame.setAttribute('stroke', '#000000');
    frame.setAttribute('stroke-width', 1);

    // Put it all together.
    personGroup.appendChild(shoulders);
    personGroup.appendChild(head);

    avatarGroup.appendChild(backgroundCircle);
    avatarGroup.appendChild(personGroup);
    avatarGroup.appendChild(frame);

    this._svgDefs.appendChild(avatarGroup);

    const useReferenceForAvatar = this._useElementForSessionAvatar(caret.sessionId);

    info.set('avatarReference', useReferenceForAvatar);
  }

  _avatarDefWithName(name) {
    for (const child of this._svgDefs.childNodes) {
      if (child.getAttribute('id') === name) {
        return child;
      }
    }

    return null;
  }

  /**
   * Removes a session avatar from the `<defs>` section of the SVG.
   *
   * @param {string} sessionId The session whose avatar is being removed.
   */
  _removeAvatarFromDefs(sessionId) {
    const avatarName = CaretOverlay.avatarNameForSessionId(sessionId);
    const avatar = this._avatarDefWithName(avatarName);

    if (avatar) {
      this._svgDefs.removeChild(avatar);
    }
  }

  /**
   * Prepares an SVG `<use>` element to use-by-reference a session avatar stored
   * in the `<defs>` section of the layer.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/use
   *
   * @param {string} sessionId The id for the session being referenced.
   * @returns {SVGUseElement} A reference to the session's avatar definition.
   */
  _useElementForSessionAvatar(sessionId) {
    const avatarName = CaretOverlay.avatarNameForSessionId(sessionId);
    const useElement = this._document.createElementNS(SVG_NAMESPACE, 'use');

    useElement.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${avatarName}`);
    useElement.setAttribute('width', AVATAR_DIMENSION);
    useElement.setAttribute('height', AVATAR_DIMENSION);

    return useElement;
  }

  /**
   * Takes a session id as input and returns a DOM id to use to reference the
   * avatar for that session in the `<defs>` section of the SVG.
   *
   * @param {string} sessionId The if for the session being referenced.
   * @returns {string} The DOM id to use when referencing the avatar definition
   *   for this session.
   */
  static avatarNameForSessionId(sessionId) {
    return `avatar-${sessionId}`;
  }

  /**
   * Finds the avatar for a given session in the `<defs>` section of the SVG and
   * updates all of its thematic color values to the given new color.
   *
   * @param {Caret} caret Caret for the session.
   */
  _updateAvatarColor(caret) {
    const avatarName = CaretOverlay.avatarNameForSessionId(caret.sessionId);
    const avatar = this._avatarDefWithName(avatarName);

    if (avatar) {
      this._updateAvatarChildColors(avatar, caret.color);
    }
  }

  /**
   * Checks the given root element to see if it has a thematic color that needs
   * updating, and then recurses through all of its children — performing the
   * same check as it goes.
   *
   * @param {SVGElement} root The local root element being inspected.
   * @param {string} color The new color value. The color must be in 3-byte hex
   *   format (e.g. `#dead37`).
   */
  _updateAvatarChildColors(root, color) {
    // Predefined elements in the `<defs>` section of the SVG that adopt the thematic color
    // for a given session are tagged with the class `avatar-theme-color`. Items in that
    // class will have their `fill` colors changed to the provided value.
    if (root.classList.contains('avatar-theme-color')) {
      if (root.hasAttribute('fill')) {
        root.setAttribute('fill', color);
      }
    }

    for (const child of root.children) {
      this._updateAvatarChildColors(child, color);
    }
  }
}
