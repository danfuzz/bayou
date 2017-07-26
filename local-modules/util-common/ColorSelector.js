// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';

/**
 * {RegExp} Regular expression that can be used to validate colors that are
 * expected to be in CSS three-byte hex format (e.g. `'#fe8ef1'`).
 */
const HEX_COLOR_REGEXP = /^#[a-fA-F0-9]{6}$/;

/**
 * Generator of an unending progression of colors. The original
 * task for which it was created was to make background colors for chat bubbles
 * in an IM app. It's good for tasks like that.
 *
 * It operates by walking its way around the HSL color wheel. By default it rotates
 * 53° around the circle for each new color. That allows you to generate 7 colors
 * before reusing large areas of hue, and even then, the primality of the
 * stride is such that you'll still get hundreds of distinct colors before obvious
 * duplicates are generated.
 *
 * The V component of each color is 87.5% which puts all of the colors in the
 * pastel range.
 */
export default class ColorSelector {
  /**
   * Checks whether a given string matches this module's requirements form
   * color hex strings.
   *
   * @param {string} hexColor The string to check.
   * @returns {string} Returns the input as-is if it meets requirements.
   */
  static checkHexColor(hexColor) {
    return TString.check(hexColor, HEX_COLOR_REGEXP);
  }

  /**
   * Constructs a new ColorSelector object.
   *
   * @param {int} [seed = 0] The initial hue angle to be used. This value will
   * be MODed with 360 to get a valid angle. The default is 0, which is pure red.
   * @param {number} [stride=53] The number of degrees of hue angle to advance on
   * each iteration.
   */
  constructor(seed = 0, stride = 53) {
    /**
     * {number} The current hue angle in degrees; the H component of an HSL color.
     */
    this._hue = seed % 360;

    /**
     * {number} The saturation; the S component of an HSL color.
     */
    this._saturation = 1.0;

    /**
     * {number} The level; the L component of an HSV color. Because HSL is biconic, a level
     * of 50% is actually full saturation. The 87.5% we use here makes all the colors
     * pastels.
     */
    this._level = 0.875;

    /**
     * {number} The angular amount, in degrees, that we'll advance the hue for each color.
     */
    this._stride = stride;
  }

  /**
   * Returns the next color in the form of a CSS hex color value (e.g. #70E4FE for a pastel blue).
   *
   * @returns {string} The hex string color value.
   */
  nextColorHex() {
    const rgb = this.nextColorRGB();
    const r = this._hexByte(rgb.red);
    const b = this._hexByte(rgb.blue);
    const g = this._hexByte(rgb.green);

    return '#' + r + g + b;
  }

  /**
   * Converts a value from 0-255 to a hex string in the range '00' .. 'ff'
   *
   * @param {number} value The number to convert. It should be in the range
   * of 0 .. 255, although no error checking is performed.
   * @returns {string} The value converted to a hexadecimal byte string.
   */
  _hexByte(value) {
    const prefix = value < 16 ? '0' : '';

    return prefix + Number(value).toString(16);
  }

  /**
   * Returns the next color in the progression in RGB form.
   *
   * @returns {object} The color value. The object returned will have keys of
   * `red`, `green`, and `blue`. The values for each key will be an integer
   * from `[0 .. 255]`.
   */
  nextColorRGB() {
    const hsl = this.nextColorHSL();
    const rgb = this._HSLToRGB(hsl);

    return rgb;
  }

  /**
   * Returns the next color in the progression in HSL form.
   *
   * @returns {object} The color value. The object returned will have keys of
   * `hue`, `saturation`, and `level`. Hue is an integer `[0 .. 360)`; saturation and level
   * are numbers from `[0.0 .. 1.0]`.
   */
  nextColorHSL() {
    return this._nextColor();
  }

  /**
   * Converts an HSL color value to RGB.
   *
   * @param {object} hsl The HSL color value to convert. The value must have keys of
   * `hue`, `saturation`, and `level`. Hue is an integer `[0 .. 360)`; saturation and level
   * are numbers from `[0.0 .. 1.0]`. No validation of the input is performed.
   * @returns {object} The color value. The object returned will have keys of
   * `red`, `green`, and `blue`. The values for each key will be an integer
   * from `[0 .. 255]`.
   */
  _HSLToRGB(hsl) {
    // Algorithm taken from https://en.wikipedia.org/wiki/HSL_and_HSV#From_HSL
    const c = (1.0 - Math.abs((2.0 * hsl.level) - 1.0) * hsl.saturation);
    const huePrime = hsl.hue / 60.0;
    const x = c * (1.0 - Math.abs((huePrime % 2) - 1.0));
    const m = hsl.level - (c / 2.0);

    let red = 0;
    let green = 0;
    let blue = 0;

    if      (huePrime <= 1) { red = c; green = x; blue = 0; }
    else if (huePrime <= 2) { red = x; green = c; blue = 0; }
    else if (huePrime <= 3) { red = 0; green = c; blue = x; }
    else if (huePrime <= 4) { red = 0; green = x; blue = c; }
    else if (huePrime <= 5) { red = x; green = 0; blue = c; }
    else                    { red = c; green = 0; blue = x; }

    return {
      red:   Math.floor((red + m) * 255),
      green: Math.floor((green + m) * 255),
      blue:  Math.floor((blue + m) * 255),
    };
  }

  /**
   * Returns the next color in the progression, and generates the following color.
   *
   * @see ColorSelection.nextColorHSL()
   * @returns {object} The HSL color value.
   */
  _nextColor() {
    const result = { hue: this._hue, saturation: this._saturation, level: this._level };

    this._advance();

    return result;
  }

  /**
   * Advances the internal state to generated the next color in the progression.
   */
  _advance() {
    this._hue = (this._hue + this._stride) % 360;
  }
}
