// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Timestamp } from 'doc-common';

/** {Int} Unix time in seconds for the start of January in the year 2010. */
const SEC_2010_JAN_01 = Math.floor(new Date(2010, 1, 1, 0, 0, 0, 0).valueOf() / 1000);

/** {Int} Unix time in seconds for the start of January in the year 2040. */
const SEC_2040_JAN_01 = Math.floor(new Date(2040, 1, 1, 0, 0, 0, 0).valueOf() / 1000);

describe('doc-common/Timestamp', () => {
  describe('check()', () => {
    it('should reject `null`', () => {
      assert.throws(() => Timestamp.check(null));
    });

    it('should reject non-instances', () => {
      assert.throws(() => Timestamp.check(37));
      assert.throws(() => Timestamp.check('x'));
      assert.throws(() => Timestamp.check(false));
      assert.throws(() => Timestamp.check({}));
      assert.throws(() => Timestamp.check(new Map()));
    });

    it('should accept an instance', () => {
      const value = new Timestamp(SEC_2010_JAN_01, 0);
      assert.strictEqual(Timestamp.check(value), value);
    });
  });

  describe('fromMsec()', () => {
    it('should produce an instance with the expected fields', () => {
      function test(v) {
        const sec  = Math.floor(v / 1000);
        const usec = Math.floor((v - (sec * 1000)) * 1000);
        const ts   = Timestamp.fromMsec(v);
        assert.strictEqual(ts.secs,  sec,  `${v} msec`);
        assert.strictEqual(ts.usecs, usec, `${v} msec`);
      }

      const start = SEC_2010_JAN_01 * 1000;
      const end   = SEC_2040_JAN_01 * 1000;
      for (let v = start, inc = 0; v < end; inc = inc * 10 + 123, v += inc) {
        test(v);
      }
    });
  });

  describe('fromUsec()', () => {
    it('should produce an instance with the expected fields', () => {
      function test(v) {
        const sec  = Math.floor(v / 1000000);
        const usec = v - (sec * 1000000);
        const ts  = Timestamp.fromUsec(v);
        assert.strictEqual(ts.secs,  sec,  `${v} usec`);
        assert.strictEqual(ts.usecs, usec, `${v} usec`);
      }

      const start = SEC_2010_JAN_01 * 1000000;
      const end   = SEC_2040_JAN_01 * 1000000;
      for (let v = start, inc = 0; v < end; inc = inc * 10 + 123, v += inc) {
        test(v);
      }
    });
  });

  describe('orNull()', () => {
    it('should accept `null`', () => {
      assert.isNull(Timestamp.orNull(null));
    });

    it('should reject non-instances', () => {
      assert.throws(() => Timestamp.orNull(37));
      assert.throws(() => Timestamp.orNull('x'));
      assert.throws(() => Timestamp.orNull(false));
      assert.throws(() => Timestamp.orNull({}));
      assert.throws(() => Timestamp.orNull(new Map()));
    });

    it('should accept an instance', () => {
      const value = new Timestamp(SEC_2010_JAN_01, 0);
      assert.strictEqual(Timestamp.orNull(value), value);
    });
  });
});
