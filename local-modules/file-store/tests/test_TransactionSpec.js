// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { FileOp, TransactionSpec } from 'file-store';

describe('file-store/TransactionSpec', () => {
  describe('concat()', () => {
    it('should concatenate a proper argument', () => {
      function test(ops1, ops2) {
        const t1      = new TransactionSpec(...ops1);
        const t2      = new TransactionSpec(...ops2);
        const result1 = t1.concat(t2);
        const result2 = t2.concat(t1);
        const resOps1 = [...result1.ops];
        const resOps2 = [...result2.ops];

        assert.instanceOf(result1, TransactionSpec);
        assert.instanceOf(result2, TransactionSpec);

        const expectOps = [...ops1, ...ops2];

        assert.strictEqual(resOps1.length, expectOps.length);
        assert.strictEqual(resOps2.length, expectOps.length);

        assert.sameMembers(resOps1, expectOps);
        assert.sameMembers(resOps2, expectOps);
      }

      test([], []);
      test([FileOp.op_revNum(10)], []);
      test([FileOp.op_revNum(10), FileOp.op_timeout(123)], []);
      test([FileOp.op_revNum(20)], [FileOp.op_checkPathPresent('/foo')]);
      test(
        [FileOp.op_timeout(123456), FileOp.op_checkPathAbsent('/bar')],
        [FileOp.op_checkPathPresent('/blort'), FileOp.op_checkPathAbsent('/florp')]
      );
    });

    it('should reject a bad argument', () => {
      const trans = new TransactionSpec(FileOp.op_timeout(123456));

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
