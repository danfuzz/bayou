// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TransactionOp, TransactionSpec } from 'file-store-ot';

import FileOpMaker from './FileOpMaker';

describe('file-store-ot/TransactionSpec', () => {
  // The call to `FileOpMaker.testCases()` provides outer `describe()`s for each
  // value to test with.
  FileOpMaker.testCases((ops) => {
    describe('constructor()', () => {
      it('should accept any number of valid arguments', () => {
        assert.doesNotThrow(() => new TransactionSpec(...ops));
      });

      // This test doesn't make sense for length 0.
      if (ops.length === 0) {
        it('should reject an invalid argument in any position', () => {
          const badValues = [undefined, null, false, 'hello', ['blort'], { x: 914 }, new Map()];
          let   badAt     = 0;

          for (let i = 0; i < ops.length; i += 9) {
            const useOps = ops.slice();
            useOps[i] = badValues[badAt];
            assert.throws(() => new TransactionSpec(...useOps), /badValue/);
            badAt = (badAt + 1) % badValues.length;
          }
        });
      }
    });

    describe('.ops', () => {
      it('should be a frozen array', () => {
        const result = new TransactionSpec(...ops);
        assert.isArray(result.ops);
        assert.isFrozen(result.ops);
      });

      it('should contain all the originally-passed args though not necessarily in the same order', () => {
        const result = new TransactionSpec(...ops);
        assert.sameMembers(result.ops, ops);
      });
    });
  });

  describe('concat()', () => {
    it('should concatenate a proper argument', () => {
      function test(ops1, ops2) {
        const t1      = new TransactionSpec(...ops1);
        const t2      = new TransactionSpec(...ops2);
        const result1 = t1.concat(t2);
        const result2 = t2.concat(t1);
        const resOps1 = result1.ops;
        const resOps2 = result2.ops;

        assert.instanceOf(result1, TransactionSpec);
        assert.instanceOf(result2, TransactionSpec);

        const expectOps = [...ops1, ...ops2];

        assert.strictEqual(resOps1.length, expectOps.length);
        assert.strictEqual(resOps2.length, expectOps.length);

        assert.sameMembers(resOps1, expectOps);
        assert.sameMembers(resOps2, expectOps);
      }

      test([], []);
      test([TransactionOp.op_revNum(10)], []);
      test([TransactionOp.op_revNum(10), TransactionOp.op_timeout(123)], []);
      test([TransactionOp.op_revNum(20)], [TransactionOp.op_checkPathPresent('/foo')]);
      test(
        [TransactionOp.op_timeout(123456), TransactionOp.op_checkPathAbsent('/bar')],
        [TransactionOp.op_checkPathPresent('/blort'), TransactionOp.op_checkPathAbsent('/florp')]
      );
    });

    it('should reject a bad argument', () => {
      const trans = new TransactionSpec(TransactionOp.op_timeout(123456));

      function test(value) {
        assert.throws(() => trans.concat(value));
      }

      test(null);
      test(undefined);
      test([1, 2, 3]);
      test(new Map());
    });
  });
});
