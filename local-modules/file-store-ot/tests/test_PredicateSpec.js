// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { PredicateOp, PredicateSpec } from 'file-store-ot';
import { FrozenBuffer } from 'util-common';

describe('file-store-ot/PredicateSpec', () => {
  describe('constructor()', () => {
    it('should accept any number of `PredicateOp`s', () => {
      function test(...ops) {
        assert.doesNotThrow(() => new PredicateSpec(...ops));
      }

      test();
      test(PredicateOp.op_revNumIs(1));
      test(
        PredicateOp.op_blobAbsent(new FrozenBuffer('x')),
        PredicateOp.op_blobPresent(new FrozenBuffer('y')));
      test(
        PredicateOp.op_pathAbsent('/foo'),
        PredicateOp.op_pathIs('/x', new FrozenBuffer('x')),
        PredicateOp.op_pathIsNot('/y', new FrozenBuffer('not-y')),
        PredicateOp.op_pathPresent('/foo/bar'));
    });

    it('should reject non-`PredicateOp`s', () => {
      const goodOps1 = [
        PredicateOp.op_revNumIs(1),
        PredicateOp.op_blobAbsent(new FrozenBuffer('x')),
        PredicateOp.op_blobPresent(new FrozenBuffer('y'))
      ];
      const goodOps2 = [
        PredicateOp.op_blobAbsent(new FrozenBuffer('a')),
        PredicateOp.op_blobPresent(new FrozenBuffer('b'))
      ];

      function test(value) {
        assert.throws(() => new PredicateSpec(value), /badValue/);
        assert.throws(() => new PredicateSpec(...goodOps1, value, ...goodOps2), /badValue/);
      }

      test(undefined);
      test(null);
      test(false);
      test(123);
      test('blort');
      test(['boop']);
      test({ x: 'florp' });
      test([PredicateOp.op_revNumIs(123)]);
      test(['x', PredicateOp.op_revNumIs(123)]);
      test([PredicateOp.op_revNumIs(123), 'x']);
    });
  });

  describe('.ops', () => {
    it('should be a frozen array', () => {
      const spec = new PredicateSpec(PredicateOp.op_revNumIs(123));
      const ops  = spec.ops;

      assert.isArray(ops);
      assert.isFrozen(ops);
    });

    it('should contain the values passed in the constructor, in the same order', () => {
      function test(...ops) {
        const spec = new PredicateSpec(...ops);

        assert.deepEqual(spec.ops, ops);
      }

      test();
      test(PredicateOp.op_revNumIs(1));
      test(
        PredicateOp.op_blobAbsent(new FrozenBuffer('x')),
        PredicateOp.op_blobPresent(new FrozenBuffer('y')));
      test(
        PredicateOp.op_pathAbsent('/foo'),
        PredicateOp.op_pathIs('/x', new FrozenBuffer('x')),
        PredicateOp.op_pathIsNot('/y', new FrozenBuffer('not-y')),
        PredicateOp.op_pathPresent('/foo/bar'));
    });
  });
});
