// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { LogRecord } from 'see-all';
import { RecentSink } from 'see-all-server';

describe('see-all-server/RecentSink', () => {
  describe('log()', () => {
    it('should log the item as given', () => {
      const sink = new RecentSink(1);

      sink.log(new LogRecord(90909, 'error', 'foo', 'bar', 'baz'));

      const contents = sink.contents;
      assert.lengthOf(contents, 1);
      assert.deepEqual(contents[0],
        { timeMsec: 90909, level: 'error', tag: 'foo', message: ['bar baz'] });
    });
  });

  describe('time()', () => {
    it('should log the time as given', () => {
      const sink = new RecentSink(1);

      sink.time(80808, 'utc-time', 'local-time');

      const contents = sink.contents;
      assert.lengthOf(contents, 1);
      assert.deepEqual(contents[0],
        { timeMsec: 80808, level: '', tag: 'time', utcString: 'utc-time', localString: 'local-time' });
    });
  });

  describe('.contents', () => {
    it('should contain all logged items assuming no `time` has been logged', () => {
      const sink = new RecentSink(1);
      const NUM_LINES = 10;

      for (let i = 0; i < NUM_LINES; i++) {
        sink.log(new LogRecord(12345 + i, 'info', 'blort', 'florp', i));
      }

      const contents = sink.contents;

      for (let i = 0; i < NUM_LINES; i++) {
        const line = contents[i];

        assert.strictEqual(line.timeMsec, 12345 + i);
        assert.strictEqual(line.level, 'info');
        assert.strictEqual(line.tag, 'blort');
        assert.strictEqual(line.message, [`florp ${i}`]);
      }
    });

    it('should only contain new-enough items if `time` was just logged', () => {
      function timeForLine(line) {
        return 12345 + (line * 100);
      }

      const NUM_LINES = 1000;
      const MAX_AGE = 2000;
      const FINAL_TIME = timeForLine(NUM_LINES);
      const sink = new RecentSink(MAX_AGE);

      for (let i = 0; i < NUM_LINES; i++) {
        sink.log(new LogRecord(timeForLine(i), 'info', 'blort', 'florp'));
      }

      sink.time(FINAL_TIME, 'utc', 'local');

      const contents = sink.contents;

      for (const line of contents) {
        if (line.tag === 'time') {
          assert.strictEqual(line.timeMsec, FINAL_TIME);
          assert.strictEqual(line.utcString, 'utc');
          assert.strictEqual(line.localString, 'local');
        } else {
          assert.isAtLeast(line.timeMsec, FINAL_TIME - MAX_AGE);
        }
      }
    });
  });

  describe('.htmlContents', () => {
    it('should return the logged lines as HTML', () => {
      const sink = new RecentSink(1);
      const NUM_LINES = 10;

      for (let i = 0; i < NUM_LINES; i++) {
        sink.log(new LogRecord(12345 + i, 'info', 'blort', 'florp', i));
      }

      const contents = sink.htmlContents;
      const lines    = contents.match(/[^\r\n]+/g);

      // Count the lines starting with `<tr>`. This is kind of a weak test but
      // it's better than nothing.

      let count = 0;
      for (const l of lines) {
        if (/^<tr>/.test(l)) {
          count++;
        }
      }

      assert.strictEqual(count, NUM_LINES);
    });
  });
});
