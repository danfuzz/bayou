// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { LogTag } from '@bayou/see-all';

describe('@bayou/see-all/LogTag', () => {
  describe('checkContextString()', () => {
    it('accepts valid strings', () => {
      function test(value) {
        assert.strictEqual(LogTag.checkContextString(value), value);
      }

      test(''); // Maybe shouldn't be valid, but in fact it is right now.
      test('a');
      test('ab');
      test('abc');
      test('blort foo!');
      test('1234567890123456789012345');
      test('12345678901234567890123456789');
    });

    it('rejects invalid values', () => {
      function test(level) {
        assert.throws(() => { LogTag.checkContextString(level); });
      }

      test('1234567890123456789012345678910'); // Too long.
      test(null);
      test(undefined);
      test(123);
      test({ a: 10 });
    });
  });

  describe('constructor', () => {
    it('accepts valid main tags', () => {
      function test(main) {
        const lt = new LogTag(main);
        assert.strictEqual(lt.main, main);
      }

      test('a');
      test('florp');
      test('florp-zorch');
      test('__florp__');
    });

    it('accepts valid context strings', () => {
      function test(...context) {
        const lt = new LogTag('x', ...context);
        assert.isArray(lt.context);
        assert.isFrozen(lt.context);
        assert.deepEqual(lt.context, context);
      }

      test();
      test('a');
      test('a', 'b');
      test('a', 'b', 'c');
      test('florp-like', 'timeline_sideways', 'x y z');
    });
  });

  describe('withAddedContext()', () => {
    it('adds the indicated context', () => {
      const lt = new LogTag('x', 'foo', 'bar');
      const result = lt.withAddedContext('zorch', 'florp');

      assert.deepEqual(result.context, ['foo', 'bar', 'zorch', 'florp']);
    });
  });
});
