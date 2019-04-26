// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TBuffer } from '@bayou/typecheck';

describe('@bayou/typecheck/TBuffer', () => {
  describe('check()', () => {
    it('accepts valid instances', () => {
      const buf = Buffer.from('123');
      assert.strictEqual(TBuffer.check(buf), buf);
    });

    it('rejects non-Buffers', () => {
      function test(value) {
        assert.throws(() => TBuffer.check(value), /badValue/);
      }

      test(null);
      test(undefined);
      test(true);
      test(123);
      test('florp');
      test([1, 2, 3]);
    });
  });

  describe('orNull()', () => {
    it('accepts valid instances', () => {
      const buf = Buffer.from('123');
      assert.strictEqual(TBuffer.orNull(buf), buf);
    });

    it('accepts `null`', () => {
      assert.isNull(TBuffer.orNull(null));
    });

    it('rejects non-`null` non-Buffers', () => {
      function test(value) {
        assert.throws(() => TBuffer.check(value), /badValue/);
      }

      test(undefined);
      test(true);
      test(123);
      test('florp');
      test([1, 2, 3]);
    });
  });
});
