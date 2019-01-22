// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { CodableError, Response } from '@bayou/api-common';
import { InfoError } from '@bayou/util-common';

describe('@bayou/api-common/Response', () => {
  describe('constructor()', () => {
    it('returns a frozen object', () => {
      const r = new Response(0, 'x');
      assert.isFrozen(r);
    });

    it('accepts non-negative integer `id`s', () => {
      function test(id) {
        assert.doesNotThrow(() => new Response(id, 'x'), /badValue/);
      }

      test(0);
      test(1);
      test(12345);
    });

    it('accepts string `id`s of appropriate length', () => {
      function test(id) {
        assert.doesNotThrow(() => new Response(id, 'x'), /badValue/);
      }

      test('12345678');
      test('abcdefghijklmnopqrstuvwxyz');
    });

    it('rejects `id`s which are not non-negative integers or appropriate-length strings', () => {
      function test(id) {
        assert.throws(() => new Response(id, 'x'), /badValue/);
      }

      test(-1);
      test(0.5);
      test(NaN);

      test('');
      test('1');
      test('1234567');

      test(undefined);
      test(null);
      test([]);
    });

    it('accepts a variety of `result`s', () => {
      function test(r) {
        assert.doesNotThrow(() => new Response(1, r));
      }

      test(undefined);
      test(null);
      test(true);
      test(123);
      test('florp');
      test([]);
      test([1, 'x', [2.5]]);
      test({ a: 'a', b: ['c', 'd', 'e'] });
    });

    it('accepts `null` and `Error`s for the `error`', () => {
      function test(e) {
        assert.doesNotThrow(() => new Response(1, null, e));
      }

      test(null);
      test(new Error('Oy!'));
      test(new InfoError('yow'));
      test(new CodableError('eeek'));
    });

    it('rejects non-`null` non-`Error`s for the `error`', () => {
      function test(e) {
        assert.throws(() => new Response(1, null, e), /badValue/);
      }

      test(true);
      test(9.14);
      test('blort');
      test([]);
      test(new Map());
    });

    it('will not construct an instance with non-`null` `result` and `error`', () => {
      assert.throws(() => new Response(1, 'x', new Error('eep')), /badUse/);
    });
  });

  describe('.error', () => {
    it('is the constructed `error` when it was a `CodableError`', () => {
      const e = new CodableError('zorch', 1, 2, 3);
      const r = new Response(1, null, e);

      assert.strictEqual(r.error, e);
    });

    it('is a `CodableError` with matching payload when the constructed `error` was an `InfoError`', () => {
      const e = new InfoError('blorp', 'what', 'is', 'happening', 'here?');
      const r = new Response(1, null, e);

      assert.instanceOf(r.error, CodableError);
      assert.strictEqual(r.error.info, e.info);
    });

    it('is a `CodableError` with the message in the payload when the constructed `error` was not an `InfoError`', () => {
      const e      = new Error('Yikes!');
      const expect = CodableError.generalError('Yikes!');
      const r      = new Response(1, null, e);

      assert.instanceOf(r.error, CodableError);
      assert.deepEqual(r.error.info, expect.info);
    });
  });

  describe('.id', () => {
    it('is the constructed `id`', () => {
      const r = new Response(1234, 'x');

      assert.strictEqual(r.id, 1234);
    });
  });

  describe('.originalError', () => {
    it('is the constructed `error`', () => {
      function test(e) {
        const r = new Response(1, null, e);
        assert.strictEqual(r.originalError, e);
      }

      test(null);
      test(new Error('Oy!'));
      test(new InfoError('yow'));
      test(new CodableError('eeek'));
    });
  });

  describe('.result', () => {
    it('is the constructed `result`', () => {
      const r = new Response(1, 'florp');

      assert.strictEqual(r.result, 'florp');
    });
  });

  describe('deconstruct()', () => {
    it('is a two-element array when there is no `error`', () => {
      const r = new Response(1, 'florp');
      const got = r.deconstruct();

      assert.deepEqual(got, [1, 'florp']);
    });

    it('is a three-element array with `null` middle element when there is an `error`', () => {
      const r = new Response(1, null, new Error('oy'));
      const got = r.deconstruct();

      assert.deepEqual(got, [1, null, r.error]);
    });
  });

  describe('isError()', () => {
    it('is `false` when there is no `error`', () => {
      const r = new Response(1, 'florp');

      assert.isFalse(r.isError());
    });

    it('is `true` when there is an `error`', () => {
      const r = new Response(1, null, new Error('oy'));

      assert.isTrue(r.isError());
    });
  });

  describe('withConservativeError()', () => {
    it('returns `this` when there is no `error`', () => {
      const r = new Response(1, 'florp');

      assert.strictEqual(r.withConservativeError(), r);
    });

    it('replaces a non-`null` `error` as promised', () => {
      const args        = [1, { x: 'x', y: 'y' }];
      const expectError = new InfoError('boop', '[ 1, { x: \'x\', y: \'y\' } ]');
      const r           = new Response(12, null, new InfoError('boop', ...args));
      const result      = r.withConservativeError();

      assert.strictEqual(result.id, r.id);
      assert.isNull(result.result);
      assert.deepEqual(result.error.info, expectError.info);
    });
  });
});
