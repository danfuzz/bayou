// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { AuthorId } from 'doc-common';
import { QuillEvent, QuillGeometry } from 'quill-util';
import { TObject } from 'typecheck';
import { ColorSelector, PromDelay } from 'util-common';

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
  constructor(quill, svgElement) {
    /**
     * {Map<AuthorId, Map<string, object>>} _Ad hoc_ storage for arbitrary data
     * associated with remote authors (highlights, color, avatar, etc).
     */
    this._authors = new Map();

    /** {QuillProm} The Quill instance hosting the document we're editing. */
    this._quill = quill;

    /**
     * {Element} The SVG element in which we'll render the selections.
     * The SVG should be the same dimensions as `this._quillInstance.scrollingContainer`
     * and on top of it in z-index order (closer to the viewer).
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
   * @param {AuthorId} authorId The author to track.
   */
  addAuthor(authorId) {
    AuthorId.check(authorId);

    this._authors.set(authorId, new Map());
  }

  /**
   * Stop tracking a new author's selections.
   *
   * @param {AuthorId} authorId The author to stop tracking.
   */
  removeAuthor(authorId) {
    AuthorId.check(authorId);

    this._authors.delete(authorId);
    this._displayNeedsRedraw();
  }

  /**
   * Updates annotation for a remote author's selection, and updates the display.
   *
   * @param {AuthorId} authorId The author whose state we're updating.
   * @param {object} selection A Quill selection object of the form
   * `{ index: Number, length: Number }`.
   */
  setAuthorSelection(authorId, selection = null) {
    AuthorId.check(authorId);

    if (!this._authors.has(authorId)) {
      this.addAuthor(authorId);
    }

    const authorInfo = this._authors.get(authorId);

    authorInfo.set('selection', selection);

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
    let currentEvent = this._quill.currentEvent;

    for (;;) {
      const selEvent = await currentEvent.nextOf(QuillEvent.SELECTION_CHANGE);

      // **TODO:** Uncomment this to see the local user's selection get
      // highlighted. Handy during development!
      // this.setAuthorSelection('local-author', selEvent.range);

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

    const paths = [];

    // TODO: For now this is just generating exlicit SVG markup strings and injecting
    //       them via innerHTML in the `<svg>` element on screen. This needs to be
    //       reworked so that we are using `document.createElement()` and working with
    //       the DOM directly.
    for (const [authorId_unused, authorInfo] of this._authors) {
      let rects = QuillGeometry.boundsForLinesInRange(this._quill, authorInfo.get('selection'));

      rects = rects.map(QuillGeometry.snapRectToPixels);

      for (const rect of rects) {
        const pathCommands = QuillGeometry.svgPathCommandsForRect(rect);

        paths.push(`<path ` +
                  `d="${pathCommands}" ` +
                  `fill=rgb(255,0,0) ` +
                  `fill-opacity="0.25" ` +
                  `stroke-width="1.0" ` +
                  `stroke=rgb(255,0,0) ` +
                  `stroke-opacity="0.75" />`
        );
      }
    }

    this._authorOverlay.innerHTML = paths.join('\n');
    this._updateScrollPosition();
  }

  /**
   * Scrolls the `<svg>` viewBox to match the scroll position of its associated Quill editor.
   */
  _updateScrollPosition() {
    const yOffset = this._quill.scrollingContainer.scrollTop;

    this._authorOverlay.setAttribute('viewBox', `0 ${yOffset} ${this._authorOverlay.clientWidth} ${this._authorOverlay.clientHeight}`);
  }
}
