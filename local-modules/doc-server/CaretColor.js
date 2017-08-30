// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';
import { StringUtil, UtilityClass } from 'util-common';

/**
 * {number} Saturation (in the HSL color model) of colors returned by this
 * class.
 */
const COLOR_SATURATION = 1.0;

/**
 * {number} Level (in the HSL color model) of colors returned by this class.
 * Because HSL is biconic, a level of 50% is actually full saturation. The 87.5%
 * we use here makes all the colors pastels.
 */
const COLOR_LEVEL = 0.875;

/** {Int} Number of initial candidate hues to use, when picking a new color. */
const INITIAL_CANDIDATES = 36; // That is, 10 degrees difference per candidate.

/** {Int} Number of top candidates to pick from, when picking a new color. */
const TOP_CANDIDATES = 8;

/**
 * Selector of likely-distinctive caret highlight colors for sessions, based on
 * currently-used colors.
 *
 * The twist about this class is that it has to operate &mdash; and avoid
 * picking overlapping colors for the most part &mdash; without being able to
 * synchronously coordinate with instances of this class running on different
 * servers. The tactic that we implement to achive this is to start with the
 * top N choices for "most distinctly different color" and pick one of them
 * pseudo-randomly based on the (guaranteed unique) session ID as the seed.
 */
export default class CaretColor extends UtilityClass {
  /**
   * Given a session ID and a set of existing colors, returns the color to use
   * for a new session with that ID.
   *
   * @param {string} sessionId ID of the nascent session.
   * @param {array<string>} usedColors List of currently-used colors, in CSS
   *   hex form.
   * @returns {string} Color to use for the session, in CSS hex form.
   */
  static colorForSession(sessionId, usedColors) {
    const seed = StringUtil.hash32(sessionId);

    if (usedColors.length === 0) {
      // No other colors to avoid. Just reduce the seed to a hue directly.
      const hue = seed % 360;
      return CaretColor._hslToRgb(hue, COLOR_SATURATION, COLOR_LEVEL);
    }

    // All the used hues, sorted by hue and with the first and last hue
    // duplicated onto ends to make distance calculations easy. **Note:**
    // Without a sort function argument, `Array.sort()` sorts in string order.
    const usedHues = usedColors.map(CaretColor._hueFromColor).sort((h1, h2) => {
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

    return CaretColor._hslToRgb(hue, COLOR_SATURATION, COLOR_LEVEL);
  }

  /**
   * Converts a value in the range `[0..255]` to a two-digit hex string.
   *
   * @param {Int} value The number to convert. It should be in the range
   *   `[0..255]`, although no error checking is performed.
   * @returns {string} The value converted to a hexadecimal byte string.
   */
  static _hexByte(value) {
    return `${(value < 16) ? '0' : ''}${value.toString(16)}`;
  }

  /**
   * Converts an HSL color value to RGB.
   *
   * @param {number} hue The hue, which must be in the range `[0..360)`.
   * @param {number} saturation The saturation, which must be in the range
   *   `[0..1]`.
   * @param {number} level The level, which must be in the range `[0..1]`.
   * @returns {string} The color value as a CSS hex string.
   */
  static _hslToRgb(hue, saturation, level) {
    // Algorithm taken from
    // <https://en.wikipedia.org/wiki/HSL_and_HSV#From_HSL>.
    const c = (1.0 - Math.abs((2.0 * level) - 1.0) * saturation);
    const huePrime = hue / 60.0;
    const x = c * (1.0 - Math.abs((huePrime % 2) - 1.0));
    const m = level - (c / 2.0);

    let red = 0;
    let green = 0;
    let blue = 0;

    if      (huePrime <= 1) { red = c; green = x; blue = 0; }
    else if (huePrime <= 2) { red = x; green = c; blue = 0; }
    else if (huePrime <= 3) { red = 0; green = c; blue = x; }
    else if (huePrime <= 4) { red = 0; green = x; blue = c; }
    else if (huePrime <= 5) { red = x; green = 0; blue = c; }
    else                    { red = c; green = 0; blue = x; }

    red   = CaretColor._hexByte(Math.floor((red + m)   * 255));
    green = CaretColor._hexByte(Math.floor((green + m) * 255));
    blue  = CaretColor._hexByte(Math.floor((blue + m)  * 255));

    return `#${red}${green}${blue}`;
  }

  /**
   * Extracts the hue component from an RGB color.
   *
   * @param {string} color The color, in CSS hex form.
   * @returns {number} The hue, as an angle in degrees, in the range `[0..360)`.
   */
  static _hueFromColor(color) {
    TString.check(color, /^#[0-9a-f]{6}$/);

    // Algorithm taken from
    // <https://en.wikipedia.org/wiki/HSL_and_HSV#Hue_and_chroma>.

    const rgb    = parseInt(color.slice(1), 16);
    const r      = rgb >> 16;
    const g      = (rgb >> 8) & 0xff;
    const b      = rgb & 0xff;

    const alpha  = 0.5 * ((r * 2) - g - b);
    const beta   = (Math.sqrt(3) / 2) * (g - b);
    const hue    = Math.atan2(beta, alpha);

    // `hue` above is in radians in the range `[-PI..PI)`, and we want degrees
    // in the range `[0..360)`.
    return ((hue / (Math.PI * 2) * 360) + 360) % 360;
  }
}
