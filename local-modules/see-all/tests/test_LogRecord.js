// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { LogRecord, LogTag } from 'see-all';

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

  describe('checkLevel()', () => {
    it('accepts valid levels', () => {
      function test(level) {
        assert.strictEqual(LogRecord.checkLevel(level), level);
      }

      for (const level of LogRecord.LEVELS) {
        test(level);
      }
    });

    it('rejects invalid levels', () => {
      function test(level) {
        assert.throws(() => { LogRecord.checkLevel(level); });
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
        const lr = new LogRecord(0, 'some-stack-trace', 'info', LOG_TAG, ...message);
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
});
