// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TargetId } from '@bayou/api-common';

describe('@bayou/api-common/TargetId', () => {
  describe('check()', () => {
    it('should accept valid ids', () => {
      function test(value) {
        assert.strictEqual(TargetId.check(value), value);
      }

      test('a');
      test('z');
      test('AZ');
      test('0123456789');
      test('.');
      test('-');
      test('_');
      test('-x-y-');
      test('_X_Y_');
      test('.x.Y.');

      for (let len = 10; len <= 64; len++) {
        test('x'.repeat(len));
        test(`-${'x'.repeat(len - 2)}-`);
        test(`_${'Y'.repeat(len - 2)}_`);
        test(`.${'0'.repeat(len - 2)}.`);
      }
    });

    it('should reject strings with invalid characters', () => {
      function test(value) {
        assert.throws(() => TargetId.check(value), /badValue/);
      }

      test('!');
      test(' ');
      test('%');
      test('what is happening?');
    });

    it('should reject the empty string', () => {
      assert.throws(() => TargetId.check(''), /badValue/);
    });

    it('should reject too-long strings', () => {
      for (let i = 65; i < 100; i++) {
        assert.throws(() => TargetId.check('x'.repeat(i)), /badValue/);
      }
    });

    it('should reject non-strings', () => {
      function test(value) {
        assert.throws(() => TargetId.check(value), /badValue/);
      }

      test(null);
      test(undefined);
      test(true);
      test(123);
      test(new Map());
    });
  });
});
