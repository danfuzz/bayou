// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BaseLogger } from 'see-all';
import { MockLogger } from 'see-all/mocks';

/** {array<string>} All the valid levels. */
const LEVELS = ['debug', 'detail', 'error', 'info', 'warn'];

// This class is tested via its subclass `MockLogger`, which records all calls
// made to `_impl_log()`.

describe('see-all/BaseLogger', () => {
  describe('validateLevel()', () => {
    it('accepts valid levels', () => {
      function test(level) {
        assert.strictEqual(BaseLogger.validateLevel(level), level);
      }

      for (const level of LEVELS) {
        test(level);
      }
    });

    it('rejects invalid levels', () => {
      function test(level) {
        assert.throws(() => { BaseLogger.validateLevel(level); });
      }

      test('');
      test('zorch');
      test(undefined);
      test({ a: 10 });
    });
  });

  describe('log()', () => {
    it('calls through to `_log_impl()` when given valid arguments', () => {
      const logger = new MockLogger();
      logger.log('info', 'blort', 7);

      assert.deepEqual(logger.record, [['info', 'blort', 7]]);
    });

    it('rejects invalid `level` arguments', () => {
      const logger = new MockLogger();
      assert.throws(() => logger.log('zorch', 'blort', 7));
    });
  });

  describe('level-specific logging methods', () => {
    function test(level) {
      describe(`${level}()`, () => {
        it('calls through to `_log_impl()` with the same arguments', () => {
          const logger = new MockLogger();
          logger[level](1, 2, 3);

          assert.deepEqual(logger.record, [[level, 1, 2, 3]]);
        });

        it('accepts a call with no arguments', () => {
          const logger = new MockLogger();
          logger[level]();

          assert.deepEqual(logger.record, [[level]]);
        });
      });
    }

    for (const level of LEVELS) {
      test(level);
    }
  });

  describe('streamFor()', () => {
    it('returns a stream which operates as expected', () => {
      const logger = new MockLogger();
      const stream = logger.streamFor('info');

      stream.write('blort');
      assert.deepEqual(logger.record, [['info', 'blort']]);
    });
  });

  describe('withPrefix()', () => {
    it('returns a logger which operates as expected', () => {
      const logger = new MockLogger();
      const prefixer = logger.withPrefix('goodness', 'gracious');

      prefixer.info('sakes', 'alive');
      assert.deepEqual(logger.record, [['info', 'goodness', 'gracious', 'sakes', 'alive']]);
    });
  });

  describe('withDynamicPrefix()', () => {
    it('returns a logger which operates as expected', () => {
      let count = 0;
      function prefunc() {
        count++;
        return [count, 'x'];
      }

      const logger = new MockLogger();
      const prefixer = logger.withDynamicPrefix(prefunc);

      prefixer.info('one');
      prefixer.info('two');
      prefixer.info('three');
      assert.deepEqual(logger.record, [
        ['info', 1, 'x', 'one'],
        ['info', 2, 'x', 'two'],
        ['info', 3, 'x', 'three'],
      ]);
    });
  });
});
