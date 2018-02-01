// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { LogRecord } from 'see-all';
import { MockLogger } from 'see-all/mocks';

// This class is tested via its subclass `MockLogger`, which records all calls
// made to `_impl_logMessage()`.

describe('see-all/BaseLogger', () => {
  describe('logMessage()', () => {
    it('calls through to `_log_impl()` when given valid arguments', () => {
      const logger = new MockLogger();
      logger.logMessage('info', 'blort', 7);

      assert.deepEqual(logger.record, [['info', [], 'blort', 7]]);
    });

    it('rejects invalid `level` arguments', () => {
      const logger = new MockLogger();
      assert.throws(() => logger.logMessage('zorch', 'blort', 7));
    });
  });

  describe('level-specific logging methods', () => {
    function test(level) {
      describe(`${level}()`, () => {
        it('calls through to `_log_impl()` with the same arguments', () => {
          const logger = new MockLogger();
          logger[level](1, 2, 3);

          assert.deepEqual(logger.record, [[level, [], 1, 2, 3]]);
        });

        it('accepts a call with no arguments', () => {
          const logger = new MockLogger();
          logger[level]();

          assert.deepEqual(logger.record, [[level, []]]);
        });
      });
    }

    for (const level of LogRecord.MESSAGE_LEVELS) {
      test(level);
    }
  });

  describe('streamFor()', () => {
    it('returns a stream which operates as expected', () => {
      const logger = new MockLogger();
      const stream = logger.streamFor('info');

      stream.write('blort');
      assert.deepEqual(logger.record, [['info', [], 'blort']]);
    });
  });
});
