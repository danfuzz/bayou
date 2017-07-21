// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { QuillEvent, QuillGeometry } from 'quill-util';
import { TObject, TInt, TString } from 'typecheck';
import { PromDelay } from 'util-common';

/**
 * Time span to wait between refreshes of remote author annotations.
 * New changes are aggregated during the delay and incorporated into
 * the next refresh.
 */
const REFRESH_DELAY_MSEC = 2000;

/**
 * The AuthorOverlay class manages the visual display of the
 * selection and insertion caret of remote users editing the
 * same document as the local user. It renders the selections
 * into an SVG element that overlays the Quill editor.
 */
export default class AuthorOverlay {
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
     * associated with remote authors (highlights, color, avatar, etc).
     */
    this._authors = new Map();

    /** {EditorComplex} Editor complex that this instance is a part of. */
    this._editorComplex = editorComplex;

    /** {Document} The HTML document hosting our annotations. */
    this._document = TObject.check(svgElement.ownerDocument, Document);

    /**
     * {Element} The SVG element in which we'll render the selections. The SVG
     * should be the same dimensions as
     * `_editorComplex.quill.scrollingContainer` and on top of it in z-index
     * order (closer to the viewer).
     */
    this._authorOverlay = TObject.check(svgElement, Element);

    /**
     * {boolean} Whether or not there is any current need to update the
     * visual selection display. This is set to `true` when updates are
     * made and back to `false` once the display has been updated.
     */
    this._displayIsDirty = false;

    this._watchSelection();
  }

  /**
   * Begin tracking a new author's selections.
   *
   * @param {string} authorSessionId The author to track.
   */
  addAuthor(authorSessionId) {
    TString.check(authorSessionId);

    this._authors.set(authorSessionId, new Map());
  }

  /**
   * Stop tracking a new author's selections.
   *
   * @param {string} authorSessionId The author to stop tracking.
   */
  removeAuthor(authorSessionId) {
    TString.check(authorSessionId);

    this._authors.delete(authorSessionId);
    this._displayNeedsRedraw();
  }

  /**
   * Updates annotation for a remote author's selection, and updates the display.
   *
   * @param {string} authorSessionId The author whose state we're updating.
   * @param {Int} index The position of the remote author caret or start of teh selection.
   * @param {Int} length The extend of the remote author selection, or 0 for just the caret.
   * @param {string} color The color to use for the background of the remote author selection.
   *    It should be in hex format (e.g. `#ffb8b8`).
   */
  setAuthorSelection(authorSessionId, index, length, color) {
    TString.check(authorSessionId);
    TInt.min(index, 0);
    TInt.min(length, 0);
    TString.check(color);

    if (!this._authors.has(authorSessionId)) {
      this.addAuthor(authorSessionId);
    }

    const authorInfo = this._authors.get(authorSessionId);

    authorInfo.set('selection', { index, length });
    authorInfo.set('color', color);

    this._displayNeedsRedraw();
  }

  /**
   * Updates the local ledger of author selections in light
   * of changes from an editor delta. For instance, if a remote author has a
   * selection of `{ index:5, length:10 }` and a delta says that there was an
   * insert of 2 characters at `index:6` then the selection will be adjusted
   * to show `{ index:5, length:12 }`
   *
   * @param {Delta} delta_unused The edit that is to be applied to each of the
   *  selections tracked by this module.
   */
  updateSelectionsWithDelta(delta_unused) {
    //  TODO
    //  for (op of delta.ops) {
    //    for (authorInfo of this._authors.values()) {
    //      update authorInfo['selection'] with op
    //    }
    //  }
    this._displayNeedsRedraw();
  }

  /**
   * Watches this instance's associated Quill object for selection-related
   * activity.
   */
  async _watchSelection() {
    let currentEvent = this._editorComplex.quill.currentEvent;

    for (;;) {
      const selEvent = await currentEvent.nextOf(QuillEvent.SELECTION_CHANGE);

      // **TODO:** Uncomment this to see the local user's selection get
      // highlighted. Handy during development!
      //this.setAuthorSelection('local-author', selEvent.range.index, selEvent.range.length, '#ffb8b8');

      currentEvent = selEvent;
    }
  }

  /**
   * Marks the current presentation as out-of-date and schedules
   * a refresh.
   */
  _displayNeedsRedraw() {
    if (this._displayIsDirty) {
      return;
    }

    this._displayIsDirty = true;
    this._waitThenUpdateDisplay();
  }

  /**
   * Waits a bit of time and then redraws remote author annotations.
   */
  async _waitThenUpdateDisplay() {
    await PromDelay.resolve(REFRESH_DELAY_MSEC);

    this._displayIsDirty = false;

    // Remove extant annotations
    while (this._authorOverlay.firstChild) {
      this._authorOverlay.removeChild(this._authorOverlay.firstChild);
    }

    // For each author…
    for (const [authorSessionId_unused, authorInfo] of this._authors) {
      // Generate a list of rectangles representing their selection…
      let rects = QuillGeometry.boundsForLinesInRange(
        this._editorComplex.quill, authorInfo.get('selection'));

      rects = rects.map(QuillGeometry.snapRectToPixels);

      // Convert each rect to an SVG path and add it to the `<svg>` overlay element.
      for (const rect of rects) {
        const pathCommands = QuillGeometry.svgPathCommandsForRect(rect);
        const path = this._document.createElementNS('http://www.w3.org/2000/svg', 'path');

        path.setAttribute('d', pathCommands);
        path.setAttribute('fill', authorInfo.get('color'));
        path.setAttribute('fill-opacity', '0.25');
        path.setAttribute('stroke-width', '1.0');
        path.setAttribute('stroke', authorInfo.get('color'));
        path.setAttribute('stroke-opacity', '0.75');

        this._authorOverlay.appendChild(path);
      }
    }
  }
}
