// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { ColorUtil } from 'util-common';

describe('ColorUtil', () => {
  describe('checkCss()', () => {
    it('should accept proper strings', () => {
      function test(v) {
        assert.doesNotThrow(() => ColorUtil.checkCss(v));
      }

      test('#000000');
      test('#123456');
      test('#789abc');
      test('#def012');
    });

    it('should reject improper strings', () => {
      function test(v) {
        assert.throws(() => ColorUtil.checkCss(v));
      }

      test('000000');   // Missing `#` prefix.
      test('#1');       // Too few characters.
      test('#1234567'); // Too many characters.
      test('#A00000');  // Uppercase hex.
      test('#0B0000');  // Uppercase hex.
      test('#00C000');  // Uppercase hex.
      test('#000D00');  // Uppercase hex.
      test('#0000E0');  // Uppercase hex.
      test('#00000F');  // Uppercase hex.
      test('#?@%^()');  // Oddball characters.
    });

    it('should reject non-strings', () => {
      function test(v) {
        assert.throws(() => ColorUtil.checkCss(v));
      }

      test(undefined);
      test(true);
      test([]);
      test({ foo: 'bar' });
    });
  });

  describe('cssFromHsl()', () => {
    it('should provide expected results', () => {
      function test(h, s, l, expected) {
        assert.strictEqual(ColorUtil.cssFromHsl(h, s, l), expected);
      }

      // Black.
      test(0,   0,   0, '#000000');
      test(90,  0,   0, '#000000');
      test(180, 0.5, 0, '#000000');
      test(270, 1.0, 0, '#000000');

      // White.
      test(0,   0,   1.0, '#ffffff');
      test(90,  0,   1.0, '#ffffff');
      test(180, 0.5, 1.0, '#ffffff');
      test(270, 1.0, 1.0, '#ffffff');

      // Grays.
      test(0, 0, 0.25, '#3f3f3f'); // Dark.
      test(0, 0, 0.5,  '#7f7f7f'); // Medium.
      test(0, 0, 0.75, '#bfbfbf'); // Light.

      test(0,   1.0, 0.5, '#ff0000'); // Pure red.
      test(60,  1.0, 0.5, '#ffff00'); // Pure yellow.
      test(120, 1.0, 0.5, '#00ff00'); // Pure green.
      test(180, 1.0, 0.5, '#00ffff'); // Pure cyan.
      test(240, 1.0, 0.5, '#0000ff'); // Pure blue.
      test(300, 1.0, 0.5, '#ff00ff'); // Pure magenta.
    });
  });

  describe('hueFromCss()', () => {
    it('should provide expected results', () => {
      function test(color, expected) {
        assert.strictEqual(ColorUtil.hueFromCss(color), expected, color);
      }

      // Black, white, and gray don't have a defined hue in the abstract, but we
      // expect the implementation to say their hue is `0`.
      test('#000000', 0);
      test('#ffffff', 0);
      test('#010101', 0);

      // Red.
      test('#ff0000', 0);
      test('#010000', 0);
      test('#881111', 0);

      // Yellow.
      test('#ffff00', 60);
      test('#010100', 60);
      test('#888811', 60);

      // Green.
      test('#00ff00', 120);
      test('#000100', 120);
      test('#118811', 120);

      // Cyan.
      test('#00ffff', 180);
      test('#000101', 180);
      test('#118888', 180);

      // Blue.
      test('#0000ff', 240);
      test('#000001', 240);
      test('#111188', 240);

      // Magenta.
      test('#ff00ff', 300);
      test('#010001', 300);
      test('#881188', 300);
    });
  });
});
