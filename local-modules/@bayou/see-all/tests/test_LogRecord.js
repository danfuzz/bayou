// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { LogRecord, LogTag } from '@bayou/see-all';
import { Functor } from '@bayou/util-common';

describe('@bayou/see-all/LogRecord', () => {
  describe('.MESSAGE_LEVELS', () => {
    it('is a frozen array of at least four elements', () => {
      assert.isArray(LogRecord.MESSAGE_LEVELS);
      assert.isFrozen(LogRecord.MESSAGE_LEVELS);
      assert.isAtLeast(LogRecord.MESSAGE_LEVELS.length, 4);
    });

    it('contains only short lowercase alphabetic strings', () => {
      for (const l of LogRecord.MESSAGE_LEVELS) {
        assert.isString(l);
        assert.isAtMost(l.length, 10);
        assert.isTrue(/^[a-z]+$/.test(l));
      }
    });
  });

  describe('checkMessageLevel()', () => {
    it('accepts valid levels', () => {
      function test(level) {
        assert.strictEqual(LogRecord.checkMessageLevel(level), level);
      }

      for (const level of LogRecord.MESSAGE_LEVELS) {
        test(level);
      }
    });

    it('rejects invalid levels', () => {
      function test(level) {
        assert.throws(() => { LogRecord.checkMessageLevel(level); });
      }

      test('');
      test('zorch');
      test(undefined);
      test({ a: 10 });
    });
  });

  describe('messageString()', () => {
    it('operates as expected', () => {
      const LOG_TAG = new LogTag('whee');

      function test(expected, ...message) {
        const lr = LogRecord.forMessage(0, 'some-stack-trace', LOG_TAG, 'info', ...message);
        const got = lr.messageString;
        assert.strictEqual(got, expected);
      }

      test(''); // No message.

      test('foo',                'foo');
      test('foo bar',            'foo', 'bar');
      test('foo bar baz',        'foo', 'bar', 'baz');
      test('\nfoo\nbar baz\n',   '\nfoo', 'bar', 'baz');
      test('foo\nbar baz\n',     'foo\n', 'bar', 'baz');
      test('foo\n\nbar\nbaz\n',  'foo', '\nbar', 'baz');
      test('foo\nbar\nbaz\n',    'foo', 'bar\n', 'baz');
      test('foo\n\nbar\nbaz\n',  'foo', '\nbar\n', 'baz');
      test('foo bar\n\nbaz\n',   'foo', 'bar', '\nbaz');
      test('foo bar\nbaz\n',     'foo', 'bar', 'baz\n');
      test('foo\nbar\nbaz\n',    'foo\nbar', 'baz');
      test('\nfoo\nbar\nbaz\n',  '\nfoo\nbar', 'baz');
      test('foo\nbar\nbaz\n',    'foo\nbar\n', 'baz');
      test('foo\nbar\n\nbaz\n',  'foo\nbar', '\nbaz');
      test('foo\nbar\nbaz\n',    'foo\nbar', 'baz\n');

      test('true',      true);
      test('false',     false);
      test('null',      null);
      test('undefined', undefined);
      test('[]',        []);
      test('123',       123);
      test('[ 1, 2 ]',  [1, 2]);
      test('{ a: 10 }', { a: 10 });
    });
  });

  describe('withTag()', () => {
    it('operates as expected on a message log', () => {
      const LOG_TAG_1 = new LogTag('one');
      const LOG_TAG_2 = new LogTag('two', 'three');

      const lr = LogRecord.forMessage(123, 'trace', LOG_TAG_1, 'info', 'x', 'y', 'z');
      const newLr = lr.withTag(LOG_TAG_2);

      assert.strictEqual(newLr.tag, LOG_TAG_2);

      assert.strictEqual(newLr.timeMsec,      lr.timeMsec);
      assert.strictEqual(newLr.stack,         lr.stack);
      assert.strictEqual(newLr.messageString, lr.messageString);
    });

    it('operates as expected on an event log', () => {
      const LOG_TAG_1 = new LogTag('uno');
      const LOG_TAG_2 = new LogTag('dos', 'tres');

      const lr = LogRecord.forEvent(123321, 'zorch', LOG_TAG_1, new Functor('x', 1, 2));
      const newLr = lr.withTag(LOG_TAG_2);

      assert.strictEqual(newLr.tag, LOG_TAG_2);

      assert.strictEqual(newLr.timeMsec, lr.timeMsec);
      assert.strictEqual(newLr.stack,    lr.stack);
      assert.strictEqual(newLr.payload,  lr.payload);
    });
  });
});
