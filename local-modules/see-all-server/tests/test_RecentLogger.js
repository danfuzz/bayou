// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { beforeEach, describe, it } from 'mocha';

import { RecentLogger } from 'see-all-server';

let log = null;
const LOG_LEVEL = 'debug';
const LOG_TAG = 'test';
const LOG_PREFIX = 'this is log line ';
const NUM_LINES = 4;

beforeEach(() => {
  log = new RecentLogger(30 * 1000);

  const now = new Date();

  for (let i = 0; i < NUM_LINES; i++) {
    log.log(now.getTime(), LOG_LEVEL, LOG_TAG, LOG_PREFIX + i);
  }
});

describe('see-all-server.RecentLogger', () => {
  describe('#time(nowMsec, utcString, localString', () => {
    it('needs a way to be tested');
  });

  describe('.contents', () => {
    it('should return the four log lines posted in the setup', () => {
      const logContents = log.contents;

      for (let i = 0; i < NUM_LINES; i++) {
        const line = logContents[i];

        assert.equal(line['level'], LOG_LEVEL);
        assert.equal(line['tag'], LOG_TAG);
        assert.equal(line['message'][0], LOG_PREFIX + i);
        assert.isTrue(Number.isSafeInteger(line['nowMsec']));
      }
    });
  });

  describe('.htmlContents', () => {
    it('should return the four log lines posted in the setup as HTML table markup', () => {
      const logContents = log.htmlContents;
      const lines = logContents.match(/[^\r\n]+/g);

      // One line for each log entry, plus one more each for the <table> and </table>
      // This is kind of a weak test but it's better than nothing.
      assert.equal(lines.length, 1 + NUM_LINES + 1);
    });
  });
});
