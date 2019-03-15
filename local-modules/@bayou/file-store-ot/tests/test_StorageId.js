// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { StorageId } from '@bayou/file-store-ot';
import { FrozenBuffer } from '@bayou/util-common';

describe('@bayou/file-store-ot/StorageId', () => {
  describe('check()', () => {
    it('accepts valid ID strings', () => {
      function test(value) {
        assert.strictEqual(StorageId.check(value), value);
      }

      test('/foo/bar');
      test(FrozenBuffer.coerce('blort').hash);
    });

    it('rejects invalid strings', () => {
      function test(value) {
        assert.throws(() => { StorageId.check(value); });
      }

      test('');
      test('x');
      test('/foo!!');
      test(FrozenBuffer.coerce('blort').hash + '123123');
    });

    it('rejects non-strings', () => {
      function test(value) {
        assert.throws(() => { StorageId.check(value); });
      }

      test(undefined);
      test(null);
      test(false);
      test(true);
      test(123);
      test(['/foo']);
    });
  });

  describe('checkOrGetHash()', () => {
    it('accepts valid hash strings', () => {
      function test(value) {
        assert.strictEqual(StorageId.checkOrGetHash(value), value);
      }

      test(FrozenBuffer.coerce('blort').hash);
      test(FrozenBuffer.coerce('zorch').hash);
    });

    it('accepts `FrozenBuffer` instances, converting to their respective hashes', () => {
      function test(value) {
        const buf = new FrozenBuffer(value);
        assert.strictEqual(StorageId.checkOrGetHash(buf), buf.hash);
      }

      test('');
      test('florp');
      test('splatch');
    });

    it('rejects invalid strings', () => {
      function test(value) {
        assert.throws(() => { StorageId.checkOrGetHash(value); });
      }

      test('');
      test('x');
      test('/x/y');
      test('/foo!!');
      test(FrozenBuffer.coerce('blort').hash + '123123');
    });

    it('rejects non-`FrozenBuffer` non-strings', () => {
      function test(value) {
        assert.throws(() => { StorageId.checkOrGetHash(value); });
      }

      test(undefined);
      test(null);
      test(false);
      test(true);
      test(123);
      test(['/foo']);
    });
  });

  describe('isInstance()', () => {
    it('returns `true` for valid ID strings', () => {
      function test(value) {
        assert.isTrue(StorageId.isInstance(value));
      }

      test('/foo/bar');
      test(FrozenBuffer.coerce('blort').hash);
    });

    it('returns `false` for invalid strings', () => {
      function test(value) {
        assert.isFalse(StorageId.isInstance(value));
      }

      test('');
      test('x');
      test('/foo!!');
      test(FrozenBuffer.coerce('blort').hash + '123123');
    });

    it('returns `false` for non-strings', () => {
      function test(value) {
        assert.isFalse(StorageId.isInstance(value));
      }

      test(undefined);
      test(null);
      test(false);
      test(true);
      test(123);
      test(['/foo']);
    });
  });
});
