// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { LogRecord } from 'see-all';

// This class is tested via its subclass `MockLogger`, which records all calls
// made to `_impl_log()`.

describe('see-all/LogRecord', () => {
  describe('.LEVELS', () => {
    it('is a frozen array of at least four elements', () => {
      assert.isArray(LogRecord.LEVELS);
      assert.isFrozen(LogRecord.LEVELS);
      assert.isAtLeast(LogRecord.LEVELS.length, 4);
    });

    it('contains only short lowercase alphabetic strings', () => {
      for (const l of LogRecord.LEVELS) {
        assert.isString(l);
        assert.isAtMost(l.length, 10);
        assert.isTrue(/^[a-z]+$/.test(l));
      }
    });
  });

  describe('validateLevel()', () => {
    it('accepts valid levels', () => {
      function test(level) {
        assert.strictEqual(LogRecord.validateLevel(level), level);
      }

      for (const level of LogRecord.LEVELS) {
        test(level);
      }
    });

    it('rejects invalid levels', () => {
      function test(level) {
        assert.throws(() => { LogRecord.validateLevel(level); });
      }

      test('');
      test('zorch');
      test(undefined);
      test({ a: 10 });
    });
  });
});
