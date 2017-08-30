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
});
