// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { Caret, CaretDelta, CaretOp } from '@bayou/doc-common';

import { MockDelta } from '@bayou/ot-common/mocks';

describe('@bayou/doc-common/CaretDelta', () => {
  describe('compose()', () => {
    // Common tester for `compose()` when passing `false` for `wantDocuent`.
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

    it('returns an empty result from `EMPTY.compose(EMPTY)`', () => {
      const result1 = CaretDelta.EMPTY.compose(CaretDelta.EMPTY, false);
      assert.instanceOf(result1, CaretDelta);
      assert.deepEqual(result1.ops, []);

      const result2 = CaretDelta.EMPTY.compose(CaretDelta.EMPTY, true);
      assert.instanceOf(result2, CaretDelta);
      assert.deepEqual(result2.ops, []);
    });

    it('rejects calls when `other` is not an instance of the class', () => {
      const delta = CaretDelta.EMPTY;

      assert.throws(() => delta.compose('blort', true));
      assert.throws(() => delta.compose(null, true));
      assert.throws(() => delta.compose(new MockDelta([]), true));
    });

    it('does not include `delete` ops when `wantDocument` is `true`', () => {
      const op1    = CaretOp.op_add(new Caret('cr-aaaaa', { authorId: 'xyz' }));
      const op2    = CaretOp.op_add(new Caret('cr-bbbbb', { authorId: 'xyz' }));
      const op3    = CaretOp.op_add(new Caret('cr-ccccc', { authorId: 'xyz' }));
      const op4    = CaretOp.op_delete('cr-bbbbb');
      const op5    = CaretOp.op_delete('cr-ddddd');
      const d1     = new CaretDelta([op1, op2]);
      const d2     = new CaretDelta([op3, op4, op5]);
      const result = d1.compose(d2, true);

      assert.sameMembers(result.ops, [op1, op3]);
    });

    describe('`delete` preceded by anything for that caret', () => {
      it('results in just the `delete`', () => {
        const endOp = CaretOp.op_delete('cr-sessi');

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
          [CaretOp.op_add(new Caret('cr-sessi', { authorId: 'xyz' }))],
          [endOp],
          [endOp]
        );

        test(
          [CaretOp.op_setField('cr-sessi', 'revNum', 5)],
          [endOp],
          [endOp]
        );
      });
    });

    describe('`setField` after `delete`', () => {
      it('results in just the `delete`', () => {
        const endOp = CaretOp.op_delete('cr-sess1');
        const setOp = CaretOp.op_setField('cr-sess1', 'revNum', 123);

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
          [CaretOp.op_add(new Caret('cr-sess1', { authorId: 'xyz' })), endOp],
          [setOp],
          [endOp]
        );
      });
    });

    describe('`setField` after `add`', () => {
      it('results in a modified `add`', () => {
        const beginOp  = CaretOp.op_add(new Caret('cr-sess1', { authorId: 'xyz' }));
        const setOp    = CaretOp.op_setField('cr-sess1', 'revNum', 123);
        const resultOp = CaretOp.op_add(new Caret('cr-sess1', { authorId: 'xyz', revNum: 123 }));

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
          [beginOp, CaretOp.op_setField('cr-sess1', 'revNum', 9999)],
          [setOp],
          [resultOp]
        );
      });
    });

    describe('`setField` after `setField`', () => {
      it('should drop earlier sets for the same field', () => {
        const setOp1 = CaretOp.op_setField('cr-sess1', 'revNum', 123);
        const setOp2 = CaretOp.op_setField('cr-sess1', 'revNum', 999);

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
