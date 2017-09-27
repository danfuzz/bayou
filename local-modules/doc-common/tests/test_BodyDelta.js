// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import Delta from 'quill-delta';
import { inspect } from 'util';

import { BodyDelta } from 'doc-common';

describe('doc-common/BodyDelta', () => {
  describe('.EMPTY', () => {
    const EMPTY = BodyDelta.EMPTY;

    it('should be an instance of `BodyDelta`', () => {
      assert.instanceOf(EMPTY, BodyDelta);
    });

    it('should be a frozen object', () => {
      assert.isFrozen(EMPTY);
    });

    it('should have an empty `ops`', () => {
      assert.strictEqual(EMPTY.ops.length, 0);
    });

    it('should have a frozen `ops`', () => {
      assert.isFrozen(EMPTY.ops);
    });

    it('should be `.isEmpty()`', () => {
      assert.isTrue(EMPTY.isEmpty());
    });
  });

  describe('static isEmpty()', () => {
    describe('valid empty values', () => {
      const values = [
        new Delta([]),
        new BodyDelta([]),
        BodyDelta.EMPTY,
        null,
        undefined,
        [],
        { ops: [] }
      ];

      for (const v of values) {
        it(`should return \`true\` for: ${inspect(v)}`, () => {
          assert.isTrue(BodyDelta.isEmpty(v));
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
        new BodyDelta(ops1),
        ops2,
        { ops: ops2 },
        new Delta(ops2),
        new BodyDelta(ops2),
        invalidNonEmptyOps,
        { ops: invalidNonEmptyOps }
      ];

      for (const v of values) {
        it(`should return \`false\` for: ${inspect(v)}`, () => {
          assert.isFalse(BodyDelta.isEmpty(v));
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
        it(`should throw for: ${inspect(v)}`, () => {
          assert.throws(() => { BodyDelta.isEmpty(v); });
        });
      }
    });
  });

  describe('isEmpty()', () => {
    describe('valid empty values', () => {
      const values = [
        new BodyDelta([]),
        BodyDelta.EMPTY,
      ];

      for (const v of values) {
        it(`should return \`true\` for: ${inspect(v)}`, () => {
          assert.isTrue(v.isEmpty());
        });
      }
    });

    describe('valid non-empty values', () => {
      const values = [
        [{ insert: 'x' }],
        [{ insert: 'line 1' }, { insert: '\n' }, { insert: 'line 2' }],
        [{ retain: 100 }]
      ];

      for (const v of values) {
        it(`should return \`false\` for: ${inspect(v)}`, () => {
          const delta = new BodyDelta(v);
          assert.isFalse(delta.isEmpty());
        });
      }
    });
  });

  describe('isDocument()', () => {
    describe('`true` cases', () => {
      const values = [
        [],
        [{ insert: 'line 1' }],
        [{ insert: 'line 1' }, { insert: '\n' }],
        [{ insert: 'line 1' }, { insert: '\n' }, { insert: 'line 2' }]
      ];

      for (const v of values) {
        it(`should return \`true\` for: ${inspect(v)}`, () => {
          assert.isTrue(new BodyDelta(v).isDocument());
        });
      }
    });

    describe('`false` cases', () => {
      const values = [
        [{ retain: 37 }],
        [{ delete: 914 }],
        [{ retain: 37, attributes: { bold: true } }],
        [{ insert: 'line 1' }, { retain: 9 }],
        [{ insert: 'line 1' }, { retain: 14 }, { insert: '\n' }],
        [{ insert: 'line 1' }, { insert: '\n' }, { retain: 23 }, { insert: 'line 2' }]
      ];

      for (const v of values) {
        it(`should return \`false\` for: ${inspect(v)}`, () => {
          assert.isFalse(new BodyDelta(v).isDocument());
        });
      }
    });
  });
});
