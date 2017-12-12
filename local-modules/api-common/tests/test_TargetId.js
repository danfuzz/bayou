// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TargetId } from 'api-common';

describe('api-common/TargetId', () => {
  describe('check()', () => {
    it('should accept valid ids', () => {
      function test(value) {
        assert.strictEqual(TargetId.check(value), value);
      }

      test('a');
      test('z');
      test('AZ');
      test('0123456789');
      test('-x-y-');
      test('_X_Y_');

      for (let len = 10; len <= 64; len++) {
        test('x'.repeat(len));
      }
    });

    it('should reject strings with invalid characters', () => {
      function test(value) {
        assert.throws(() => TargetId.check(value), /bad_value/);
      }

      test('!');
      test(' ');
      test('%');
      test('what is happening?');
    });

    it('should reject the empty string', () => {
      assert.throws(() => TargetId.check(''), /bad_value/);
    });

    it('should reject too-long strings', () => {
      for (let i = 65; i < 100; i++) {
        assert.throws(() => TargetId.check('x'.repeat(i)), /bad_value/);
      }
    });

    it('should reject non-strings', () => {
      function test(value) {
        assert.throws(() => TargetId.check(value), /bad_value/);
      }

      test(null);
      test(undefined);
      test(true);
      test(123);
      test(new Map());
    });
  });

  describe('minLen()', () => {
    it('should accept valid ids', () => {
      function test(value, minLen) {
        assert.strictEqual(TargetId.minLen(value, minLen), value);
      }

      test('abc', 1);
      test('xyz', 3);
      test('0123456789', 5);
    });

    it('should reject strings with invalid characters', () => {
      function test(value) {
        assert.throws(() => TargetId.minLen(value, 5), /bad_value/);
      }

      test('!abcd');
      test(' abcd');
      test('%abcd');
      test('what is happening?');
    });

    it('should reject too-short strings', () => {
      function test(value, minLen) {
        assert.throws(() => TargetId.minLen(value, minLen), /bad_value/);
      }

      test('', 1);
      test('', 10);
      test('a', 2);
      test('a', 3);
      test('a', 30);
      test('ab', 3);
    });

    it('should reject too-long strings', () => {
      for (let i = 65; i < 100; i++) {
        assert.throws(() => TargetId.minLen('x'.repeat(i), 10), /bad_value/);
      }
    });

    it('should reject non-strings', () => {
      function test(value) {
        assert.throws(() => TargetId.check(value, 2), /bad_value/);
      }

      test(null);
      test(undefined);
      test(true);
      test(123);
      test(new Map());
    });
  });
});
