// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { StringUtil } from 'util-common';

describe('util-common/StringUtil', () => {
  describe('graphemesForString()', () => {
    it('should return `.length` graphemes when passed ASCII input', () => {
      const input = 'this is a string';
      const asciiLength = input.length;
      const graphemes = StringUtil.graphemesForString(input);

      assert.equal(asciiLength, graphemes.length);
    });

    it('should return one grapheme for each emoji in the input', () => {
      const input = '🤣🇫🇷🇮🇪';
      const graphemes = StringUtil.graphemesForString(input);

      assert.equal(graphemes.length, 3);
    });

    it('should return one grapheme for each composed character', () => {
      const input = '\u006e\u0303'; // ñ constructed with n + ~ combining character
      const graphemes = StringUtil.graphemesForString(input);

      assert.equal(graphemes.length, 1);
    });
  });

  describe('hash32()', () => {
    it('should hash as expected', () => {
      function test(expected, s) {
        assert.strictEqual(StringUtil.hash32(s), expected);
      }

      // These hashes can be verified by running this (and similar) from a
      // shell console:
      //
      // ```
      // $ printf '<text>' | openssl dgst -sha256 | cut -c 1-8
      // 27ce5aa0
      // ```

      test(0xe3b0c442, '');
      test(0x7ace431c, '~');
      test(0xc775e7b7, '1234567890');
      test(0x42146b29, '/a/b/c');
      test(0x15363cf2, 'blort');
      test(0x27ce5aa0, '<text>');
      test(0x86bda720, 'These pretzels are making me thirsty.');
    });
  });

  describe('utf8LengthForString()', () => {
    it('should return a UTF-8 length of 1 for ASCII characters', () => {
      const input = 'this is a string';
      const asciiLength = input.length;
      const utf8Length = StringUtil.utf8LengthForString(input);

      assert.equal(asciiLength, utf8Length);
    });

    it('should return a UTF-8 length of 2 for characters `\\u0080 .. \\u07ff', () => {
      let input = '\u0080';
      let utf8Length = StringUtil.utf8LengthForString(input);

      assert.equal(utf8Length, 2);

      input = '\u07ff';
      utf8Length = StringUtil.utf8LengthForString(input);

      assert.equal(utf8Length, 2);
    });

    it('should return a UTF-8 length of 3 for characters `\\u0800 .. \\u7fff', () => {
      let input = '\u0800';
      let utf8Length = StringUtil.utf8LengthForString(input);

      assert.equal(utf8Length, 3);

      input = '\u7fff';
      utf8Length = StringUtil.utf8LengthForString(input);

      assert.equal(utf8Length, 3);
    });
  });

  describe('stringWithUtf8ByteLimit()', () => {
    it('should pass-through inputs that fit within the byte limit', () => {
      const input = '🇫🇷'; // If your editor doesn't render this, it's the flag of France.
      const output = StringUtil.stringWithUtf8ByteLimit(input, 100);

      assert.equal(input, output);
    });

    it('should trim strings that exceed the limit, but do it at a grapheme boundary', () => {
      const input = '🇫🇷🇮🇪'; // If your editor doesn't render this, it's the flag of France followed by the flag of Ireland.
      const output = StringUtil.stringWithUtf8ByteLimit(input, 10);
      const utf8Length = StringUtil.utf8LengthForString(output);

      // The Unicode flags are composed of two UTF-16 surrogate pairs totaling 8 UTF-8 bytes.
      // For instance, The flag of France is
      //   REGIONAL INDICATOR SYMBOL LETTER F + REGIONAL INDICATOR SYMBOL LETTER R
      //   \uD83C\uDDEB\uD83C\uDDF7
      //
      // Having the UTF-8 limit set for 10 puts it amid the Irish flag. If the code is working
      // correctly it should scale back to the last full grapheme that fits, which is just the
      // French flag.
      assert.equal(output, '🇫🇷');
      assert.equal(utf8Length, 8);
    });
  });
});
