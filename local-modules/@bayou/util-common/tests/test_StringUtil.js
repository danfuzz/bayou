// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { StringUtil } from '@bayou/util-common';

describe('@bayou/util-common/StringUtil', () => {
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

    it('rejects non-strings', () => {
      function test(v) {
        assert.throws(() => StringUtil.hash32(v));
      }

      test(undefined);
      test(true);
      test([]);
      test({ foo: 'bar' });
    });
  });
});
