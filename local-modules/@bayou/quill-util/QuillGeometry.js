// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * A collection of code to help with reconciling Quill contents
 * with on-screen pixel positions.
 */
export class QuillGeometry {
  /**
   * Takes a Quill character offset and returns a bounding rectangle for an
   * insertion point cursor at that offset.
   *
   * @param {Quill} quill The Quill editor instance that we're measuring against
   * @param {Int} offset The character offset within the Quill document.
   * @returns {object} A bounds objects representing the
   *  screen bounds of the insertion point. A bounds object is
   *  `{ left, top, right (exclusive), bottom (exclusive), width, height }`.
   */
  static boundsForCursorAtOffset(quill, offset) {
    const bounds = quill.getBounds(offset, 1);

    bounds.right = bounds.left + 1;
    bounds.width = 1;

    return QuillGeometry.snapRectToPixels(bounds);
  }

  /**
   * Takes a Quill selection range and returns an array of bounding
   * rectangles for that range.
   *
   * @param {Quill} quill The Quill editor instance that we're measuring against
   * @param {Int} index Start position of the range.
   * @param {Int} length Length of (number of cursor positions in) the range.
   * @param {boolean} includeLeading A flag indicating whether the space between
   *  successive lines of text should be included in the result. If
   *  set to `true` then a rectangle representing the leading will be inserted
   *  between each pair of line bounds.
   * @returns {array<object>} An array of bounds objects representing the
   *  screen bounds of each line of the provided range in top-to-bottom
   *  visual order. A bounds object is
   *  `{ left, top, right (exclusive), bottom (exclusive), width, height }`.
   *  If `range` is a nonsensical value then `[]` is returned.
   */
  static boundsForLinesInRange(quill, index, length, includeLeading = false) {
    // Get the list of Quill Lines represented by the selection.
    const lines = quill.getLines({ index, length });

    if (lines.length < 1) {
      return [];
    }

    // Get the screen bounds of each line.
    const lineBounds = lines.map((line) => {
      // Convert line index to character range.
      const characterOffset = quill.getIndex(line);

      // Convert character range to screen rectangle.
      const bounds = quill.getBounds(characterOffset, line.length());

      bounds.left = bounds.left;
      bounds.top = bounds.top;
      bounds.right = bounds.right;
      bounds.bottom = bounds.bottom;

      bounds.width = bounds.right - bounds.left;
      bounds.height = bounds.bottom - bounds.top;

      return bounds;
    });

    // At this point we have the bounds of each whole line. However, the first
    // and last lines of a selection may not be completely selected. So, offset
    // those line bounds. Note that in the case of a single line the first and
    // last line are the same line.

    // Start by getting the leftmost pixel position of the first character in
    // the range.
    const leadingBounds = quill.getBounds(index, 1);

    lineBounds[0].left = leadingBounds.left;
    lineBounds[0].width = lineBounds[0].right - lineBounds[0].left;
    lineBounds[0].bottom = leadingBounds.bottom;
    lineBounds[0].height = lineBounds[0].bottom - lineBounds[0].top;

    // Then by getting the rightmost bound of the last character in the range.
    const lastLineIndex = lineBounds.length - 1;
    const trailingBounds = quill.getBounds(index + length - 1, 1);

    lineBounds[lastLineIndex].right = trailingBounds.right;
    lineBounds[lastLineIndex].width = lineBounds[lastLineIndex].right - lineBounds[lastLineIndex].left;
    lineBounds[lastLineIndex].bottom = trailingBounds.bottom;
    lineBounds[lastLineIndex].height = lineBounds[lastLineIndex].bottom - lineBounds[lastLineIndex].top;

    // Early exit for the non-leading case.
    if (includeLeading === false) {
      return lineBounds;
    }

    const lineBoundsAndLeading = [];

    lineBoundsAndLeading.push(lineBounds[0]);

    for (let i = 1; i < lineBounds.length; i++) {
      const lastLine = lineBounds[i - 1];
      const currentLine = lineBounds[i];

      lineBoundsAndLeading.push({
        left: lastLine.left,
        top: lastLine.bottom,
        right: lastLine.right,
        bottom: currentLine.top,
        width: lastLine.right - lastLine.left,
        height: currentLine.top - lastLine.bottom
      });

      lineBoundsAndLeading.push(currentLine);
    }

    return lineBoundsAndLeading;
  }

  /**
   * Take a bounds object and return a copy with all of its
   * values constrained to integer bounds.
   *
   * @param {object} rect The rectangle to convert. The object minimally needs
   *   properties of `left`, `top`, `right`, `bottom` all with `{number}`
   *   values.
   * @returns {object} An object with properties left, `top`, `right`, `bottom`,
   *   `width`, `height` all with integer values.
   */
  static snapRectToPixels(rect) {
    const result = {
      left: Math.floor(rect.left),
      top: Math.floor(rect.top),

      right: Math.ceil(rect.right),
      bottom: Math.ceil(rect.bottom),

      width: rect.right - rect.left,
      height: rect.bottom - rect.top
    };

    return result;
  }

  /**
   * Converts a rectangle object to a string that can be used as the `d`
   * property of an SVG `<path>` element.
   * @see https://www.w3.org/TR/SVG/paths.html
   *
   * @param {object} rect The rectangle to convert. See
   *   `QuillGeometry.boundsForLinesInRange()` for a description of a rect
   *   object.
   * @returns {string} The SVG path data for the given rectangle.
   */
  static svgPathCommandsForRect(rect) {
    return `M ${rect.left} ${rect.top} h ${rect.width} v ${rect.height} h -${rect.width} v -${rect.height} z`;
  }
}
