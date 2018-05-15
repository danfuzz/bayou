// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import Delta from 'quill-delta';

import { BodyChange, BodyDelta, BodyOp } from '@bayou/doc-common';
import { Timestamp } from '@bayou/ot-common';

describe('@bayou/doc-common/BodyChange', () => {
  describe('.FIRST', () => {
    const first = BodyChange.FIRST;

    it('should be an instance of `BodyChange`', () => {
      assert.instanceOf(first, BodyChange);
    });

    it('should be a frozen object', () => {
      assert.isFrozen(first);
    });

    it('should have the expected properties', () => {
      assert.deepEqual(first.delta, BodyDelta.EMPTY);
      assert.strictEqual(first.revNum, 0);
      assert.isNull(first.authorId);
      assert.isNull(first.timestamp);
    });
  });

  describe('constructor()', () => {
    it('should produce a frozen instance', () => {
      const result = new BodyChange(0, BodyDelta.EMPTY);
      assert.isFrozen(result);
    });

    it('should accept valid arguments, which should be reflected in the accessors', () => {
      function test(...args) {
        const [revNum, delta, timestamp = null, authorId = null] = args;
        const result = new BodyChange(...args);
        assert.strictEqual(result.revNum, revNum);
        assert.strictEqual(result.delta, delta);
        assert.strictEqual(result.timestamp, timestamp);
        assert.strictEqual(result.authorId, authorId);
      }

      test(0,   new BodyDelta([BodyOp.op_retain(100)]));
      test(123, BodyDelta.EMPTY);
      test(909, new BodyDelta([BodyOp.op_text('x')]), null);
      test(909, new BodyDelta([BodyOp.op_text('x')]), Timestamp.MIN_VALUE);
      test(242, BodyDelta.EMPTY,                      null, null);
      test(242, BodyDelta.EMPTY,                      null, 'florp9019');
    });

    it('should accept an array for the `delta`, which should get passed to the `BodyDelta` constructor', () => {
      const ops    = [BodyOp.op_retain(100)];
      const result = new BodyChange(0, ops);

      assert.deepEqual(result.delta.ops, ops);
    });

    it('should reject invalid arguments', () => {
      function test(...args) {
        assert.throws(() => new BodyChange(...args));
      }

      // Invalid `revNum`.
      test(-1,    BodyDelta.EMPTY);
      test(1.5,   BodyDelta.EMPTY);
      test('1',   BodyDelta.EMPTY);
      test([1],   BodyDelta.EMPTY);
      test(null,  BodyDelta.EMPTY);
      test(false, BodyDelta.EMPTY);

      // Invalid 'delta'.
      test(0, null);
      test(0, undefined);
      test(0, false);
      test(0, new Map());
      test(0, { ops: [] });
      test(0, new Delta()); // Needs to be a `BodyDelta`.

      // Invalid `timestamp`.
      test(0, BodyDelta.EMPTY, false);
      test(0, BodyDelta.EMPTY, 0);
      test(0, BodyDelta.EMPTY, []);
      test(0, BodyDelta.EMPTY, new Date());
      test(0, BodyDelta.EMPTY, Date.now());

      // Invalid `authorId`.
      test(0, BodyDelta.EMPTY, null, false);
      test(0, BodyDelta.EMPTY, null, 123);
      test(0, BodyDelta.EMPTY, null, [123]);
      test(0, BodyDelta.EMPTY, null, new Map());
    });
  });
});
