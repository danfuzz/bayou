// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import Delta from 'quill-delta';
import util from 'util';

import { FrozenDelta } from 'doc-common';

describe('doc-common/FrozenDelta', () => {
  describe('EMPTY', () => {
    const empty = FrozenDelta.EMPTY;

    it('should be an instance of `FrozenDelta`', () => {
      assert.instanceOf(empty, FrozenDelta);
    });

    it('should be a frozen object', () => {
      assert.isFrozen(empty);
    });

    it('should have an empty `ops`', () => {
      assert.strictEqual(empty.ops.length, 0);
    });

    it('should have a frozen `ops`', () => {
      assert.isFrozen(empty.ops);
    });

    it('should be `FrozenDelta.isEmpty()`', () => {
      assert.isTrue(FrozenDelta.isEmpty(empty));
    });
  });

  describe('isEmpty', () => {
    describe('valid empty values', () => {
      const values = [
        new Delta([]),
        new FrozenDelta([]),
        FrozenDelta.EMPTY,
        null,
        undefined,
        [],
        { ops: [] }
      ];

      for (const v of values) {
        it(`should return \`true\` for: ${util.inspect(v)}`, () => {
          assert.isTrue(FrozenDelta.isEmpty(v));
        });
      }
    });

    describe('valid non-empty values', () => {
      const ops1 = [{ insert: 'x' }];
      const ops2 = [{ insert: 'line 1' }, { insert: '\n' }, { insert: 'line 2' }];

      // This one is not a valid `ops` array, but per docs, `isEmpty()` doesn't
      // inspect the contents of `ops` arrays and so using this value should
      // succeed.
      const invalidNonEmptyOps = [null, undefined, /blort/, 1, 2, 3];

      const values = [
        ops1,
        { ops: ops1 },
        new Delta(ops1),
        new FrozenDelta(ops1),
        ops2,
        { ops: ops2 },
        new Delta(ops2),
        new FrozenDelta(ops2),
        invalidNonEmptyOps,
        { ops: invalidNonEmptyOps }
      ];

      for (const v of values) {
        it(`should return \`false\` for: ${util.inspect(v)}`, () => {
          assert.isFalse(FrozenDelta.isEmpty(v));
        });
      }
    });

    describe('non-delta-like values', () => {
      const values = [
        37,
        true,
        false,
        '',
        'this better not work!',
        {},
        () => true,
        /blort/,
        Symbol.for('foo')
      ];

      for (const v of values) {
        it(`should throw for: ${util.inspect(v)}`, () => {
          assert.throws(() => { FrozenDelta.isEmpty(v); });
        });
      }
    });
  });

  describe('isDocument(doc)', () => {
    describe('`true` cases', () => {
      const values = [
        [],
        [{ insert: 'line 1' }],
        [{ insert: 'line 1' }, { insert: '\n' }],
        [{ insert: 'line 1' }, { insert: '\n' }, { insert: 'line 2' }]
      ];

      for (const v of values) {
        it(`should return \`true\` for: ${util.inspect(v)}`, () => {
          assert.isTrue(FrozenDelta.coerce(v).isDocument());
        });
      }
    });

    describe('`false` cases', () => {
      const values = [
        [{ retain: 37 }],
        [{ insert: 'line 1' }, { retain: 9 }],
        [{ insert: 'line 1' }, { retain: 14 }, { insert: '\n' }],
        [{ insert: 'line 1' }, { insert: '\n' }, { retain: 23 }, { insert: 'line 2' }]
      ];

      for (const v of values) {
        it(`should return \`false\` for: ${util.inspect(v)}`, () => {
          assert.isFalse(FrozenDelta.coerce(v).isDocument());
        });
      }
    });
  });
});
