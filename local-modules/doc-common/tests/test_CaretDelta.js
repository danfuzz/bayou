// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { Caret, CaretDelta, CaretOp } from 'doc-common';

import { MockDelta } from 'doc-common/mocks';

describe('doc-common/CaretDelta', () => {
  describe('compose()', () => {
    // Common tester for all of `compose()`.
    function test(ops1, ops2, expectOps) {
      const d1     = new CaretDelta(ops1);
      const d2     = new CaretDelta(ops2);
      const result = d1.compose(d2, false);

      assert.strictEqual(result.ops.length, expectOps.length);

      const opSet = new Set();
      for (const op of result.ops) {
        opSet.add(op);
      }

      for (const op of expectOps) {
        let found = false;
        for (const x of opSet) {
          if (x.equals(op)) {
            found = true;
            opSet.delete(x);
            break;
          }
        }

        assert.isTrue(found, inspect(op));
      }
    }

    it('should return an empty result from `EMPTY.compose(EMPTY)`', () => {
      const result1 = CaretDelta.EMPTY.compose(CaretDelta.EMPTY, false);
      assert.instanceOf(result1, CaretDelta);
      assert.deepEqual(result1.ops, []);

      const result2 = CaretDelta.EMPTY.compose(CaretDelta.EMPTY, true);
      assert.instanceOf(result2, CaretDelta);
      assert.deepEqual(result2.ops, []);
    });

    it('should reject calls when `other` is not an instance of the class', () => {
      const delta = CaretDelta.EMPTY;

      assert.throws(() => delta.compose('blort', true));
      assert.throws(() => delta.compose(null, true));
      assert.throws(() => delta.compose(new MockDelta([]), true));
    });

    describe('`endSession` preceded by anything for that session', () => {
      it('should result in just the `endSession`', () => {
        const endOp = CaretOp.op_endSession('session1');

        test(
          [endOp],
          [],
          [endOp]
        );

        test(
          [],
          [endOp],
          [endOp]
        );

        test(
          [endOp],
          [endOp],
          [endOp]
        );

        test(
          [CaretOp.op_beginSession(new Caret('session1'))],
          [endOp],
          [endOp]
        );

        test(
          [CaretOp.op_setField('session1', 'revNum', 5)],
          [endOp],
          [endOp]
        );
      });
    });

    describe('`setField` after `endSession`', () => {
      it('should result in just the `endSession`', () => {
        const endOp = CaretOp.op_endSession('session1');
        const setOp = CaretOp.op_setField('session1', 'revNum', 123);

        test(
          [endOp, setOp],
          [],
          [endOp]
        );

        test(
          [],
          [endOp, setOp],
          [endOp]
        );

        test(
          [endOp],
          [setOp],
          [endOp]
        );

        test(
          [CaretOp.op_beginSession(new Caret('session1')), endOp],
          [setOp],
          [endOp]
        );
      });
    });

    describe('`setField` after `beginSession`', () => {
      it('should result in a modified `beginSession`', () => {
        const beginOp  = CaretOp.op_beginSession(new Caret('session1'));
        const setOp    = CaretOp.op_setField('session1', 'revNum', 123);
        const resultOp = CaretOp.op_beginSession(new Caret('session1', { revNum: 123 }));

        test(
          [beginOp, setOp],
          [],
          [resultOp]
        );

        test(
          [],
          [beginOp, setOp],
          [resultOp]
        );

        test(
          [beginOp],
          [setOp],
          [resultOp]
        );

        test(
          [beginOp, CaretOp.op_setField('session1', 'revNum', 9999)],
          [setOp],
          [resultOp]
        );
      });
    });

    describe('`setField` after `setField`', () => {
      it('should drop earlier sets for the same field', () => {
        const setOp1 = CaretOp.op_setField('session1', 'revNum', 123);
        const setOp2 = CaretOp.op_setField('session1', 'revNum', 999);

        test(
          [setOp1, setOp2],
          [],
          [setOp2]
        );

        test(
          [],
          [setOp1, setOp2],
          [setOp2]
        );

        test(
          [setOp1],
          [setOp2],
          [setOp2]
        );
      });
    });
  });
});
