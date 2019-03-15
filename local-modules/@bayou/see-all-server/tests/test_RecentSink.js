// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { LogRecord, LogTag } from '@bayou/see-all';
import { RecentSink } from '@bayou/see-all-server';

/** {LogTag} Handy instance. */
const LOG_TAG = new LogTag('blort-tag');

describe('@bayou/see-all-server/RecentSink', () => {
  describe('log()', () => {
    it('logs a regular item as given', () => {
      const sink   = new RecentSink(1);
      const record = LogRecord.forMessage(90909, 'yay-stack', LOG_TAG, 'error', 'bar', 'baz');

      sink.sinkLog(record);

      const contents = sink.contents;
      assert.lengthOf(contents, 1);
      assert.strictEqual(contents[0], record);
    });

    it('logs a time record as given', () => {
      const sink = new RecentSink(1);
      const lr   = LogRecord.forTime(80808);

      sink.sinkLog(lr);

      const contents = sink.contents;
      assert.lengthOf(contents, 1);
      assert.strictEqual(contents[0], lr);
    });
  });

  describe('.contents', () => {
    it('contains all logged items assuming no `time` has been logged', () => {
      const sink = new RecentSink(1);
      const NUM_LINES = 10;

      for (let i = 0; i < NUM_LINES; i++) {
        sink.sinkLog(LogRecord.forMessage(12345 + i, 'yay-stack', LOG_TAG, 'info', 'florp', i));
      }

      const contents = sink.contents;

      for (let i = 0; i < NUM_LINES; i++) {
        const lr = contents[i];

        assert.strictEqual(lr.timeMsec, 12345 + i);
        assert.strictEqual(lr.stack, 'yay-stack');
        assert.strictEqual(lr.tag, LOG_TAG);
        assert.strictEqual(lr.payload.name, 'info');
        assert.deepEqual(lr.payload.args, ['florp', i]);
      }
    });

    it('only contains new-enough items if `time` was just logged', () => {
      function timeForLine(line) {
        return 12345 + (line * 100);
      }

      const NUM_LINES = 1000;
      const MAX_AGE = 2000;
      const FINAL_TIME = timeForLine(NUM_LINES);
      const sink = new RecentSink(MAX_AGE);

      for (let i = 0; i < NUM_LINES; i++) {
        sink.sinkLog(LogRecord.forMessage(timeForLine(i), 'yay-stack', LOG_TAG, 'info', 'florp'));
      }

      sink.sinkLog(LogRecord.forTime(FINAL_TIME));

      const contents = sink.contents;

      for (const lr of contents) {
        if (lr.tag === 'time') {
          assert.strictEqual(lr.timeMsec, FINAL_TIME);
        } else {
          assert.isAtLeast(lr.timeMsec, FINAL_TIME - MAX_AGE);
        }
      }
    });
  });

  describe('.htmlContents', () => {
    it('returns the logged lines as HTML', () => {
      const sink = new RecentSink(1);
      const NUM_LINES = 10;

      for (let i = 0; i < NUM_LINES; i++) {
        sink.sinkLog(LogRecord.forMessage(12345 + i, 'yay-stack', LOG_TAG, 'info', 'florp', i));
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
