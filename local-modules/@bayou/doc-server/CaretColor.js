// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from '@bayou/typecheck';
import { ColorUtil, StringUtil, UtilityClass } from '@bayou/util-common';

/**
 * {number} Saturation (in the HSL color model) of colors returned by this
 * class.
 */
const COLOR_SATURATION = 1.0;

/**
 * {number} Lightness (in the HSL color model) of colors returned by this class.
 * Because HSL is biconic, a lightness of 50% is actually full saturation. The
 * 87.5% we use here makes all the colors pastels.
 */
const COLOR_LIGHTNESS = 0.875;

/** {Int} Number of initial candidate hues to use, when picking a new color. */
const INITIAL_CANDIDATES = 36; // That is, 10 degrees difference per candidate.

/** {Int} Number of top candidates to pick from, when picking a new color. */
const TOP_CANDIDATES = 8;

/**
 * Selector of likely-distinctive caret highlight colors for carets, based on
 * currently-used colors.
 *
 * The twist about this class is that it has to operate &mdash; and avoid
 * picking overlapping colors for the most part &mdash; without being able to
 * synchronously coordinate with instances of this class running on different
 * servers. The tactic that we implement to achive this is to start with the
 * top N choices for "most distinctly different color" and pick one of them
 * pseudo-randomly based on the (guaranteed unique) caret ID as the seed.
 */
export class CaretColor extends UtilityClass {
  /**
   * Given a caret ID and a set of existing colors, returns the color to use
   * for a new caret with that ID.
   *
   * @param {string} caretId ID of the nascent caret.
   * @param {array<string>} usedColors List of currently-used colors, in CSS
   *   hex form.
   * @returns {string} Color to use for the caret, in CSS hex form.
   */
  static colorForCaret(caretId, usedColors) {
    TString.check(caretId); // We don't really need to care about caret ID syntax here.

    const seed = StringUtil.hash32(caretId);

    if (usedColors.length === 0) {
      // No other colors to avoid. Just reduce the seed to a hue directly.
      const hue = seed % 360;
      return ColorUtil.cssFromHsl(hue, COLOR_SATURATION, COLOR_LIGHTNESS);
    }

    // All the used hues, sorted by hue and with the first and last hue
    // duplicated onto ends to make distance calculations easy. **Note:**
    // Without a sort function argument, `Array.sort()` sorts in string order.
    const usedHues = usedColors.map(ColorUtil.hueFromCss).sort((h1, h2) => {
      if      (h1 < h2) { return -1; }
      else if (h1 > h2) { return 1;  }
      else              { return 0;  }
    });
    usedHues.unshift(usedHues[usedHues.length - 1] - 360);
    usedHues.push(usedHues[1] + 360);

    // Make a set of candidate hues. Each element is a pair `{hue, distance}`,
    // where `distance` is the angular distance from the nearest used color.
    const candidateHues = [];
    const hueStride = 360 / INITIAL_CANDIDATES;
    for (let hue = seed % hueStride; hue < 360; hue += hueStride) {
      // Shift away `usedHues` elements such that the candidate sits between the
      // first two elements.
      while (hue > usedHues[1]) {
        usedHues.shift();
      }

      // The distance is the smaller absolute angular distance of the candidate
      // to its `usedHues` neighbors.
      const distance = Math.min(hue - usedHues[0], usedHues[1] - hue);

      candidateHues.push({ hue, distance });
    }

    // Sort the candidates by most-to-least distance.
    candidateHues.sort((c1, c2) => {
      const d1 = c1.distance;
      const d2 = c2.distance;
      if      (d1 > d2) { return -1; }
      else if (d1 < d2) { return 1;  }
      else              { return 0;  }
    });

    // Pick one of the top N based on the seed.
    const hue = candidateHues[seed % TOP_CANDIDATES].hue;

    return ColorUtil.cssFromHsl(hue, COLOR_SATURATION, COLOR_LIGHTNESS);
  }
}
