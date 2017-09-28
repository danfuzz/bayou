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

  describe('coerce()', () => {
    describe('instances of the actual class', () => {
      const values = [
        BodyDelta.EMPTY,
        new BodyDelta([]),
        new BodyDelta([{ insert: '123' }])
      ];

      for (const v of values) {
        it(`should yield the same value for: ${inspect(v)}`, () => {
          const result = BodyDelta.coerce(v);
          assert.strictEqual(result, v);
        });
      }
    });

    describe('valid empty arguments', () => {
      const values = [
        [],
        new Delta([])
      ];

      for (const v of values) {
        it(`should yield \`EMPTY\` for: ${inspect(v)}`, () => {
          const result = BodyDelta.coerce(v);
          assert.strictEqual(result, BodyDelta.EMPTY);
        });
      }
    });

    describe('valid non-empty arguments', () => {
      const values = [
        [{ insert: 'x' }],
        [{ delete: 123 }],
        [{ retain: 123 }],
        [{ insert: 'x', attributes: { bold: true } }],
        [{ insert: 'florp' }, { insert: 'x', attributes: { bold: true } }],
        new Delta([{ insert: 'x' }])
      ];

      for (const v of values) {
        it(`should succeed for: ${inspect(v)}`, () => {
          const result = BodyDelta.coerce(v);
          assert.instanceOf(result, BodyDelta);
        });
      }
    });

    describe('invalid arguments', () => {
      const values = [
        { ops: [] },
        null,
        undefined,
        false,
        123,
        'florp',
        /xyz/,
        new Map()
      ];

      for (const v of values) {
        it(`should fail for: ${inspect(v)}`, () => {
          assert.throws(() => BodyDelta.coerce(v));
        });
      }
    });
  });

  describe('constructor()', () => {
    describe('valid arguments', () => {
      // This one is not a valid `ops` array, but per docs, the constructor
      // doesn't inspect the contents of `ops` arrays and so using this value
      // should succeed (for some values of the terms "should" and "succeed").
      const invalidNonEmptyOps = [null, undefined, ['x'], { a: 10 }, 1, 2, 3];

      const values = [
        [],
        [{ insert: 'x' }],
        [{ delete: 123 }],
        [{ retain: 123 }],
        [{ insert: 'x', attributes: { bold: true } }],
        [{ insert: 'florp' }, { insert: 'x', attributes: { bold: true } }],
        invalidNonEmptyOps
      ];

      for (const v of values) {
        it(`should succeed for: ${inspect(v)}`, () => {
          new BodyDelta(v);
        });
      }
    });

    describe('invalid arguments', () => {
      const values = [
        null,
        undefined,
        123,
        'florp',
        { insert: 123 },
        new Map()
      ];

      for (const v of values) {
        it(`should fail for: ${inspect(v)}`, () => {
          assert.throws(() => new BodyDelta(v));
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
});
