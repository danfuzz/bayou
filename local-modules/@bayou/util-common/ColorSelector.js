// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ColorUtil } from './ColorUtil';

import { CommonBase } from '@bayou/util-core';

/**
 * Generator of an unending progression of colors. The original
 * task for which it was created was to make background colors for chat bubbles
 * in an IM app. It's good for tasks like that.
 *
 * It operates by walking its way around the HSL color wheel. By default it
 * rotates 53° around the circle for each new color. That allows you to generate
 * 7 colors before reusing large areas of hue, and even then, the primality of
 * the stride is such that you'll still get hundreds of distinct colors before
 * obvious duplicates are generated.
 *
 * The V component of each color is 87.5% which puts all of the colors in the
 * pastel range.
 */
export class ColorSelector extends CommonBase {
  /**
   * Constructs a new ColorSelector object.
   *
   * @param {Int} [seed = 0] The initial hue angle to be used. This value will
   *   be MODed with 360 to get a valid angle. The default is 0, which is pure
   *   red.
   * @param {number} [stride=53] The number of degrees of hue angle to advance
   *   on each iteration.
   */
  constructor(seed = 0, stride = 53) {
    super();

    /**
     * {number} The current hue angle in degrees; the H component of an HSL
     * color.
     */
    this._hue = seed % 360;

    /**
     * {number} The saturation; the S component of an HSL color.
     */
    this._saturation = 1.0;

    /**
     * {number} The lightness; the L component of an HSL color. Because HSL is
     * biconic, a lightness of 50% is actually full saturation. The 87.5% we use
     * here makes all the colors pastels.
     */
    this._lightness = 0.875;

    /**
     * {number} The angular amount, in degrees, that we'll advance the hue for
     * each color.
     */
    this._stride = stride;
  }

  /**
   * Returns the next color in the progression in RGB form.
   *
   * @returns {string} The color value, as a CSS hex string.
   */
  nextCssColor() {
    const hsl = this.nextColorHSL();
    return ColorUtil.cssFromHsl(hsl.hue, hsl.saturation, hsl.lightness);
  }

  /**
   * Returns the next color in the progression in HSL form.
   *
   * @returns {object} The color value. The object returned will have keys of
   * `hue`, `saturation`, and `lightness`. Hue is an integer `[0 .. 360)`;
   * saturation and lightness are numbers from `[0.0 .. 1.0]`.
   */
  nextColorHSL() {
    return this._nextColor();
  }

  /**
   * Returns the next color in the progression, and generates the following
   * color.
   *
   * @see ColorSelection.nextColorHSL()
   * @returns {object} The HSL color value.
   */
  _nextColor() {
    const result = { hue: this._hue, saturation: this._saturation, lightness: this._lightness };

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
