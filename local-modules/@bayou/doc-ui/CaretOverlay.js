// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CaretId, CaretOp, CaretSnapshot } from '@bayou/doc-common';
import { Delay } from '@bayou/promise-util';
import { QuillEvents, QuillGeometry } from '@bayou/quill-util';
import { TObject } from '@bayou/typecheck';

/**
 * {Int} Amount of time (in msec) to wait after noticing a local edit before
 * looking for a new one.
 */
const LOCAL_EDIT_DELAY_MSEC = 1000;

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
     *   [caret/selection drawing commands for caret A]
     *   <use href="#avatarA" />
     *   [caret/selection drawing commands for caret B]
     *   <use href="#avatarB" />
     *   [caret/selection drawing commands for caret N]
     *   <use href="#avatarN" />
     * </svg>
     * ```
     */
    this._svgOverlay = TObject.check(svgElement, Element);

    /**
     * {SVGDefsElement} The `<defs>` element within `_svgOverlay`. This holds
     * reusable definitions such as clip paths, gradients, caret avatars, etc.
     * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/defs
     */
    this._svgDefs = this._addInitialSvgDefs();

    /**
     * {CaretSnapshot} The last caret snapshot we received from `ClientStore`.
     * We diff the new snapshot against it to find what changed.
     */
    this._lastCaretSnapshot = CaretSnapshot.EMPTY;

    /**
     * {Map<string, SVGUseElement>} Map from caret ID to the `<use>` elements
     * for each avatar. By pre-allocating them and storing one for each
     * caret we can avoid the cost of redrawing the user avatar each update
     * and can instead just translate the x/y position of this `<use>`
     * reference.
     */
    this._useReferences = new Map();

    /**
     * {ClientStore} Data store and its associated mutation state machine
     * used for updating the client data model as changes come from the
     * server.
     */
    this._clientStore = editorComplex.clientStore;

    /**
     * {function} Function which acts as our receipt for having subscribed
     * to changes to the caret store. If called, this function will
     * unsubscribe this module from further change notifications.
     */
    this._caretSubscription = this._clientStore.subscribe(this._onCaretChange.bind(this));

    // Call the change callback once to make sure initial state is set.
    this._onCaretChange();

    this._watchLocalEdits();
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
      currentEvent = await currentEvent.nextOf(QuillEvents.TYPE_textChange);

      // Skip any additional text changes that have already been posted, so that
      // we won't just be slowly iterating over all changes.
      currentEvent = currentEvent.latestOfNow(QuillEvents.TYPE_textChange);

      log.detail('Got local edit event.');
      this._updateDisplay();

      // Wait a moment, before looking for more changes. If there are multiple
      // changes during this time, the `latestOfNow()` call above will elide
      // them.
      await Delay.resolve(LOCAL_EDIT_DELAY_MSEC);
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

    // Draw the remote author cursors and highlights.

    // For each caret...
    for (const [caretId, caret] of this._lastCaretSnapshot.entries()) {
      // Is this caret us? If so, don't draw anything. **TODO:** The caret
      // snapshot ideally wouldn't actually represent the caret controlled by
      // this editor. The code that pushes the snapshot into the store should
      // be updated accordingly.
      if (this._editorComplex.docSession.controlsCaret(caretId)) {
        continue;
      }

      const avatarReference = this._useReferences.get(caretId);

      if (caret.length === 0) {
        // Length of zero means an insertion point instead of a selection
        const rect = QuillGeometry.boundsForCursorAtOffset(quill, caret.index);

        const pathCommand = QuillGeometry.svgPathCommandsForRect(rect);
        const path = this._document.createElementNS(SVG_NAMESPACE, 'path');

        // Even for a zero-width rect we get what we expect when we stroke the
        // frame.
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
   * Constructs an avatar image for the caret and adds it to the `<defs>`
   * section of the SVG.
   *
   * @param {Caret} caret The caret for which we're adding an avatar def.
   */
  _addAvatarToDefs(caret) {
    // The whole avatar is set in a group with a known id.
    const avatarGroup = this._document.createElementNS(SVG_NAMESPACE, 'g');
    const id          = caret.id;

    avatarGroup.setAttribute('id', CaretOverlay._domIdFromCaretId(id));

    // Add the circle that will hold the background color.
    const backgroundCircle = this._document.createElementNS(SVG_NAMESPACE, 'circle');

    backgroundCircle.setAttribute('cx', 200 * AVATAR_SCALE_FACTOR);
    backgroundCircle.setAttribute('cy', 200 * AVATAR_SCALE_FACTOR);
    backgroundCircle.setAttribute('r', 195 * AVATAR_SCALE_FACTOR);
    backgroundCircle.setAttribute('fill', caret.color);
    backgroundCircle.classList.add('avatar-theme-color');

    // Create a new group to hold the head and shoulders and clip it to the mask
    // we made earlier.
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

    // Turn the avatar stuff off for now.
    // **TODO:** Turn this back on with a better UI.
    //avatarGroup.appendChild(backgroundCircle);
    //avatarGroup.appendChild(personGroup);
    //avatarGroup.appendChild(frame);

    this._svgDefs.appendChild(avatarGroup);

    const useReferenceForAvatar = this._createUseElementForSessionAvatar(caret.id);

    this._useReferences.set(caret.id, useReferenceForAvatar);
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
   * Removes a caret avatar from the `<defs>` section of the SVG.
   *
   * @param {string} caretId ID of the caret whose avatar is being removed.
   */
  _removeAvatarFromDefs(caretId) {
    const avatarName = CaretOverlay._domIdFromCaretId(caretId);
    const avatar = this._avatarDefWithName(avatarName);

    if (avatar) {
      this._svgDefs.removeChild(avatar);
    }

    this._useReferences.delete(caretId);
  }

  /**
   * Prepares an SVG `<use>` element to use-by-reference a caret avatar stored
   * in the `<defs>` section of the layer.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/use
   *
   * @param {string} caretId The ID of the caret.
   * @returns {SVGUseElement} A reference to the caret's avatar definition.
   */
  _createUseElementForSessionAvatar(caretId) {
    const avatarName = CaretOverlay._domIdFromCaretId(caretId);
    const useElement = this._document.createElementNS(SVG_NAMESPACE, 'use');

    useElement.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${avatarName}`);
    useElement.setAttribute('width', AVATAR_DIMENSION);
    useElement.setAttribute('height', AVATAR_DIMENSION);

    return useElement;
  }

  /**
   * Finds the avatar for a given caret in the `<defs>` section of the SVG and
   * updates all of its thematic color values to the given new color.
   *
   * @param {Caret} caret Caret in question.
   */
  _updateAvatarColor(caret) {
    const avatarName = CaretOverlay._domIdFromCaretId(caret.id);
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
    // Predefined elements in the `<defs>` section of the SVG that adopt the
    // thematic color for a given caret are tagged with the class
    // `avatar-theme-color`. Items in that class will have their `fill` colors
    // changed to the provided value.
    if (root.classList.contains('avatar-theme-color')) {
      if (root.hasAttribute('fill')) {
        root.setAttribute('fill', color);
      }
    }

    for (const child of root.children) {
      this._updateAvatarChildColors(child, color);
    }
  }

  /**
   * Callback function which reponds to change notifications from the caret
   * data model store. It keeps a copy of the prior caret snapshot and user
   * that to diff against when new changes come in.
   *
   * TODO: Currently _updateDisplay() blows away all of the SVG child elements
   *       and adds them fresh with each call. With the fine(r)-grained change
   *       diffing below, and a cache of the elements, we should be able to
   *       merely modify them in place rather than starting from scratch
   *       each time.
   */
  _onCaretChange() {
    const oldSnapshot = this._lastCaretSnapshot;
    const newSnapshot = this._clientStore.getState().carets;
    const delta = oldSnapshot.diff(newSnapshot).delta;
    let updateDisplay = false;

    this._lastCaretSnapshot = newSnapshot;

    for (const op of delta.ops) {
      const props = op.props;

      switch (props.opName) {
        case CaretOp.CODE_add: {
          this._addAvatarToDefs(props.caret);
          updateDisplay = true;
          break;
        }

        case CaretOp.CODE_delete: {
          this._removeAvatarFromDefs(props.caretId);
          updateDisplay = true;
          break;
        }

        case CaretOp.CODE_setField: {
          const caretId = props.caretId;

          if (this._editorComplex.docSession.controlsCaret(caretId)) {
            continue;
          }

          if (props.key === 'color') {
            const caret = newSnapshot.get(caretId);

            this._updateAvatarColor(caret);
          }

          updateDisplay = true;
          break;
        }
      }
    }

    if (updateDisplay) {
      this._updateDisplay();
    }
  }

  /**
   * Takes a caret ID as input and returns a DOM ID to use to reference the
   * avatar for that caret in the `<defs>` section of the SVG.
   *
   * @param {string} caretId The ID for the caret being referenced.
   * @returns {string} The DOM ID to use when referencing the avatar definition
   *   for this caret.
   */
  static _domIdFromCaretId(caretId) {
    const rawId = CaretId.payloadFromId(caretId);
    return `avatar-${rawId}`;
  }
}
