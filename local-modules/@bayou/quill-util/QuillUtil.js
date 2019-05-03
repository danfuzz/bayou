// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Editor } from '@bayou/config-client';
import { TObject } from '@bayou/typecheck';
import { UtilityClass } from '@bayou/util-common';

const POSITION_NOT_FOUND = Object.freeze({
  blot: null,
  blotOffset: 0,
  line: null,
  lineOffset: 0,
  range: Object.freeze({ index: -1, length: 0 })
});

/**
 * Miscellaneous helpers for interacting with Quill that didn't fit anywhere
 * else.
 */
export class QuillUtil extends UtilityClass {
  /**
   * Return value for {@link #quillContextForPixelPosition} for cases where the
   * pixel is not in the Quill context. All properties are nulled/zeroed except
   * for `range: [-1, 0]`.
   */
  static get POSITION_NOT_FOUND() {
    return POSITION_NOT_FOUND;
  }

  /**
   * Takes a pixel position in local DOM coordinates (such as might be in the
   * `clientX` and `clientY` fields of a drop event), projects it onto a Quill
   * context, and returns information about the location of that pixel.
   *
   * The object returned will indicate the various aspects of the pixel position
   * in the Quill context. The object will have the following keys:
   *
   * * `blot`: the blot surrounding the pixel location.
   * * `blotOffset`: the offset of that blot from the beginning of the document.
   * * `line`: the line object that contained the pixel position.
   * * `lineOffset`: the offset of that line from the beginning of the document.
   * * `range`: an object of the form `{ index: number, length 1 }`.
   *
   * If the pixel is not found in the Quill context then `POSITION_NOT_FOUND`
   * will be returned.
   *
   * @param {QuillProm} quillInstance The Quill context in which to search for
   *   the pixel position.
   * @param {number} x The horizontal pixel offset in local (DOM context) space.
   * @param {number} y The vertical pixel offset in local (DOM context) space.
   * @returns {object} The Quill context where the pixel is located.
   */
  static quillContextForPixelPosition(quillInstance, x, y) {
    if (!quillInstance || (! (quillInstance instanceof Editor.QuillProm))) {
      return POSITION_NOT_FOUND;
    }

    const document = quillInstance.domNode.ownerDocument;
    const domElement = document.elementFromPoint(x, y);

    if (domElement === null) {
      return POSITION_NOT_FOUND;
    }

    const containerBounds = quillInstance.container.getBoundingClientRect();

    // The `quill.getBounds()` calls further down return rectancles relative
    // the quill container element so we need to offset x and y by that
    // amount before we start making comparisons.
    x -= containerBounds.x;
    y -= containerBounds.y;

    const blotOrQuill = Editor.QuillProm.find(domElement, true);

    // If we get a Quill instance back instead of a blot then we aren't going to
    // find the offset.
    if (blotOrQuill instanceof Editor.QuillProm) {
      return POSITION_NOT_FOUND;
    }

    const blot = blotOrQuill;
    const blotOffset = quillInstance.getIndex(blot);
    const [line, lineOffset] = quillInstance.getLine(blotOffset);

    let low = blotOffset - 1;
    let high = blotOffset + blot.length();
    let probe;
    let probeBounds;

    // Binary search through the blot range looking for a bounding box that
    // contains our pixel. Tim Bray's formulation is used:
    // * <https://www.tbray.org/ongoing/When/200x/2003/03/22/Binary>
    // Read that article even if you think you totally grok binary search.
    while (high - low > 1) {
      probe = (low + high) >>> 1;

      // The 1 represents a single "thing" in the blot. Could be a character or
      // some other object depending on how the blot reports its contents.
      // Without the 1 we get a width of zero which isn't helpful.
      probeBounds = quillInstance.getBounds(probe, 1);

      // We weight the search to find y-axis match first (get us on the correct
      // line) then for an x-axis match (correct lateral offset).
      if (y < probeBounds.top) {
        high = probe;
      } else if (y >= probeBounds.bottom) {
        low = probe;
      } else if (x < probeBounds.left) {
        high = probe;
      } else {
        low = probe;
      }
    }

    // If we're out of bounds then we didn't find it.
    if (low === -1) {
      return POSITION_NOT_FOUND;
    }

    probeBounds = quillInstance.getBounds(low, 1);

    if ((x < probeBounds.left)
    ||  (x >= probeBounds.right)
    ||  (y < probeBounds.top)
    ||  (y >= probeBounds.bottom)) {

      // Special case 1: user dropped their content exactkt on the `\n` at the
      // end of the line. In this case Quill reports the bounds with `left` and
      // `right` equal to each other and negative.
      const dropOnEndOfLine = (probeBounds.width === 0) && (probeBounds.left < 0);

      // Special case 2: user dropped their content way off the edge of the
      // line, past the `\n`. In that case we'll see that we're within the
      // height of the line but all the prior checks above said we're outside
      // the lateral bounds.
      const dropAfterEndOfLine = (y >= probeBounds.top) && (y < probeBounds.bottom);

      // The -1 in the range calculation is to keep the drop inside the `\n`,
      // otherwise it represents offset 0 on the following line.
      if (dropOnEndOfLine || dropAfterEndOfLine) {
        return Object.freeze({
          blot,
          blotOffset,
          line,
          lineOffset,
          range: { index: blotOffset + blot.length() - 1, length: 0 }
        });
      }

      // If we've gotten here then we definitely have exhausted all checks and
      // we can't resolve the drop.
      return POSITION_NOT_FOUND;
    }

    // Hooray, we found a match, and it's within the bounds of other content on
    // the line rather than past the end of the line.
    return Object.freeze({
      blot,
      blotOffset,
      line,
      lineOffset,
      range: { index: low, length: 0 }
    });
  }

  /**
   * Returns the `<div>` container for the entire Quill complex.
   *
   * @param {QuillProm} quill The Quill instance whose container will be
   *   returned.
   * @returns {HTMLDivElement} The container `<div>`.
   */
  static containerDiv(quill) {
    TObject.check(quill, Editor.QuillProm);

    return quill.container;
  }

  /**
   * Returns the `<div>` representing the editor.
   *
   * @param {QuillProm} quill The Quill instance whose editor `<div>` is to be
   *   returned.
   * @returns {HTMLDivElement} The editor `<div>`.
   */
  static editorDiv(quill) {
    TObject.check(quill, Editor.QuillProm);

    return QuillUtil.containerDiv(quill).getElementsByClassName('ql-editor').item(0);
  }
}
