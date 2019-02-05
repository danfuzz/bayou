// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BearerToken, TargetId } from '@bayou/api-common';

describe('@bayou/api-common/TargetId', () => {
  describe('check()', () => {
    it('accepts valid IDs', () => {
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

      for (let len = 200; len <= 256; len++) {
        test('x'.repeat(len));
        test(`-${'x'.repeat(len - 2)}-`);
        test(`_${'Y'.repeat(len - 2)}_`);
        test(`.${'0'.repeat(len - 2)}.`);
      }
    });

    it('rejects strings with invalid characters', () => {
      function test(value) {
        assert.throws(() => TargetId.check(value), /badValue/);
      }

      test('!');
      test(' ');
      test('%');
      test('what is happening?');
    });

    it('rejects the empty string', () => {
      assert.throws(() => TargetId.check(''), /badValue/);
    });

    it('rejects too-long strings', () => {
      for (let i = 257; i < 500; i++) {
        assert.throws(() => TargetId.check('x'.repeat(i)), /badValue/, `length ${i}`);
      }
    });

    it('rejects non-strings', () => {
      function test(value) {
        assert.throws(() => TargetId.check(value), /badValue/);
      }

      test(null);
      test(undefined);
      test(true);
      test(123);
      test(new Map());
      test(new BearerToken('x', 'xy'));
    });
  });

  describe('orToken()', () => {
    it('accepts valid ID strings', () => {
      function test(value) {
        assert.strictEqual(TargetId.orToken(value), value);
      }

      test('abc_123');
      test('0123.456-789');
    });

    it('accepts `BearerToken` instances', () => {
      const token = new BearerToken('abc', 'abc-xyz');
      assert.strictEqual(TargetId.orToken(token), token);
    });

    it('rejects invalid strings', () => {
      assert.throws(() => TargetId.orToken('!?%'), /badValue/);
    });

    it('rejects non-`BearerToken` non-strings', () => {
      function test(value) {
        assert.throws(() => TargetId.orToken(value), /badValue/);
      }

      test(null);
      test(undefined);
      test(true);
      test(123);
      test(new Map());
    });
  });

  describe('safeString()', () => {
    it('returns the argument if is is a valid ID string', () => {
      function test(s) {
        assert.strictEqual(TargetId.safeString(s), s);
      }

      test('abc_123');
      test('0123.456-789');
    });

    it('returns the safe version of a given `BearerToken`', () => {
      function test(id, secret) {
        const token = new BearerToken(id, `${id}-${secret}`);
        assert.strictEqual(TargetId.safeString(token), token.safeString);
      }

      test('foo',   '123123-8999');
      test('x',     'abc_def');
      test('b.c.d', 'zorch');
    });

    it('rejects invalid strings', () => {
      assert.throws(() => TargetId.safeString('!?%'), /badValue/);
    });

    it('rejects non-`BearerToken` non-strings', () => {
      function test(value) {
        assert.throws(() => TargetId.safeString(value), /badValue/);
      }

      test(null);
      test(undefined);
      test(true);
      test(123);
      test(new Map());
    });
  });

  describe('targetString()', () => {
    it('returns the argument if is is a valid ID string', () => {
      function test(s) {
        assert.strictEqual(TargetId.targetString(s), s);
      }

      test('abc_123');
      test('0123.456-789');
    });

    it('returns the secret token out of a given `BearerToken`', () => {
      function test(id, secret) {
        const token = new BearerToken(id, `${id}-${secret}`);
        assert.strictEqual(TargetId.targetString(token), token.secretToken);
      }

      test('foo',   '123123-8999');
      test('x',     'abc_def');
      test('b.c.d', 'zorch');
    });

    it('rejects invalid strings', () => {
      assert.throws(() => TargetId.targetString('!?%'), /badValue/);
    });

    it('should reject non-`BearerToken` non-strings', () => {
      function test(value) {
        assert.throws(() => TargetId.targetString(value), /badValue/);
      }

      test(null);
      test(undefined);
      test(true);
      test(123);
      test(new Map());
    });
  });
});
