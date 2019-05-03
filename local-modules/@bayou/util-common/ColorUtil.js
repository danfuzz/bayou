// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TNumber, TString } from '@bayou/typecheck';
import { UtilityClass } from '@bayou/util-core';

/**
 * {RegExp} Regular expression that can be used to validate colors that are
 * expected to be in CSS three-byte hex format, with lowercase letters (e.g.,
 * `#fe8ef1`).
 */
const CSS_COLOR_REGEXP = /^#[a-f0-9]{6}$/;

/**
 * Color manipulation utilities.
 */
export class ColorUtil extends UtilityClass {
  /**
   * Checks whether a given string matches this module's requirements for a
   * CSS-style color hex string, with all lowercase letters and no alpha
   * component.
   *
   * @param {string} hexColor The string to check.
   * @returns {string} The input as-is if it meets requirements.
   */
  static checkCss(hexColor) {
    return TString.check(hexColor, CSS_COLOR_REGEXP);
  }

  /**
   * Converts an HSL color value to the three-byte CSS hex form, with lowercase
   * letters.
   *
   * @param {number} hue The hue, which must be in the range `[0..360)`.
   * @param {number} saturation The saturation, which must be in the range
   *   `[0..1]`.
   * @param {number} lightness The lightness, which must be in the range
   *   `[0..1]`.
   * @returns {string} The color value as a CSS hex string.
   */
  static cssFromHsl(hue, saturation, lightness) {
    TNumber.range(hue, 0, 360);
    TNumber.rangeInc(saturation, 0, 1);
    TNumber.rangeInc(lightness, 0, 1);

    // Algorithm taken from
    // <https://en.wikipedia.org/wiki/HSL_and_HSV#From_HSL>.
    const c = (1.0 - Math.abs((2.0 * lightness) - 1.0)) * saturation;
    const huePrime = hue / 60.0;
    const x = c * (1.0 - Math.abs((huePrime % 2) - 1.0));
    const m = lightness - (c / 2.0);

    let red, green, blue;

    if      (huePrime <= 1) { red = c; green = x; blue = 0; }
    else if (huePrime <= 2) { red = x; green = c; blue = 0; }
    else if (huePrime <= 3) { red = 0; green = c; blue = x; }
    else if (huePrime <= 4) { red = 0; green = x; blue = c; }
    else if (huePrime <= 5) { red = x; green = 0; blue = c; }
    else                    { red = c; green = 0; blue = x; }

    red   = ColorUtil._hexByte(Math.floor((red   + m) * 255));
    green = ColorUtil._hexByte(Math.floor((green + m) * 255));
    blue  = ColorUtil._hexByte(Math.floor((blue  + m) * 255));

    return `#${red}${green}${blue}`;
  }

  /**
   * Extracts the hue component from an RGB color given as a three-byte
   * lowercase CSS hex string.
   *
   * @param {string} color The color, in lowercase CSS hex form.
   * @returns {number} The hue, as an angle in degrees, in the range `[0..360)`.
   */
  static hueFromCss(color) {
    ColorUtil.checkCss(color);

    // Algorithm taken from
    // <https://en.wikipedia.org/wiki/HSL_and_HSV#Hue_and_chroma>.

    const rgb   = parseInt(color.slice(1), 16);
    const r     = rgb >> 16;
    const g     = (rgb >> 8) & 0xff;
    const b     = rgb & 0xff;

    const alpha = 0.5 * ((r * 2) - g - b);
    const beta  = (Math.sqrt(3) / 2) * (g - b);
    const hue   = Math.atan2(beta, alpha);

    // `hue` above is in radians in the range `[-PI..PI)`, and we want degrees
    // in the range `[0..360)`.
    return ((hue / (Math.PI * 2) * 360) + 360) % 360;
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
}
