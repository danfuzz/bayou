// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { ColorSelector } from 'util-common';

describe('ColorSelector', () => {
  describe('.constructor()', () => {
    it('should default to a hue angle of pure red if given no seed', () => {
      const selector = new ColorSelector();
      const hsl = selector.nextColorHSL();

      assert.equal(hsl.hue, 0);
    });

    it('should have a default hue angle stride of 53°', () => {
      const selector = new ColorSelector();
      const colorA = selector.nextColorHSL();
      const colorB = selector.nextColorHSL();

      assert.equal(colorA.hue, colorB.hue - 53);
    });

    it('should have a default HSL level of 87.5%', () => {
      const selector = new ColorSelector();
      const hsl = selector.nextColorHSL();

      assert.equal(hsl.level, 0.875);
    });

    it('should set the initial hue angle to the seed value MOD 360', () => {
      const selector = new ColorSelector(397);
      const hsl = selector.nextColorHSL();

      assert.equal(hsl.hue, 37);
    });

    it('should advance the hue color angle by the given stride if provided to the constructor', () => {
      const selector = new ColorSelector(0, 37);
      const colorA = selector.nextColorHSL();
      const colorB = selector.nextColorHSL();

      assert.equal(colorA.hue, colorB.hue - 37);
    });

    describe('.nextCssColor()', () => {
      it('should return a valid hex string representation of the RGB value of a given color', () => {
        const selector = new ColorSelector();
        const hex = selector.nextCssColor();

        assert.equal(hex, '#ffbfbf');
      });
    });
  });
});
