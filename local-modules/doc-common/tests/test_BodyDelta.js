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

  describe('compose()', () => {
    it('should return an empty result from `EMPTY.compose(EMPTY)`', () => {
      const result = BodyDelta.EMPTY.compose(BodyDelta.EMPTY);
      assert.instanceOf(result, BodyDelta);
      assert.deepEqual(result.ops, []);
    });

    it('should reject calls when `other` is not an instance of the class', () => {
      const delta = BodyDelta.EMPTY;
      const other = 'blort';
      assert.throws(() => delta.compose(other));
    });
  });

  describe('diff()', () => {
    it('should return an empty result from `EMPTY.diff(EMPTY)`', () => {
      const result = BodyDelta.EMPTY.diff(BodyDelta.EMPTY);
      assert.instanceOf(result, BodyDelta);
      assert.deepEqual(result.ops, []);
    });

    it('should reject calls when `this` is not a document', () => {
      const delta = new BodyDelta([{ retain: 10 }]);
      const other = BodyDelta.EMPTY;
      assert.throws(() => delta.diff(other));
    });

    it('should reject calls when `other` is not a document', () => {
      const delta = BodyDelta.EMPTY;
      const other = new BodyDelta([{ retain: 10 }]);
      assert.throws(() => delta.diff(other));
    });

    it('should reject calls when `other` is not an instance of the class', () => {
      const delta = BodyDelta.EMPTY;
      const other = 'blort';
      assert.throws(() => delta.diff(other));
    });
  });

  describe('compose() / diff()', () => {
    // These tests take composition triples `origDoc + change = newDoc` and test
    // `compose()` and `diff()` in various combinations.
    function test(label, origDoc, change, newDoc) {
      origDoc = new BodyDelta(origDoc);
      change  = new BodyDelta(change);
      newDoc  = new BodyDelta(newDoc);

      describe(label, () => {
        it('should produce the expected composition', () => {
          const result = origDoc.compose(change);
          assert.instanceOf(result, BodyDelta);
          assert.deepEqual(result.ops, newDoc.ops);
        });

        it('should produce the expected diff', () => {
          const result = origDoc.diff(newDoc);
          assert.instanceOf(result, BodyDelta);
          assert.deepEqual(result.ops, change.ops);
        });

        it('should produce the new doc when composing the orig doc with the diff', () => {
          const diff   = origDoc.diff(newDoc);
          const result = origDoc.compose(diff);
          assert.instanceOf(result, BodyDelta);
          assert.deepEqual(result.ops, newDoc.ops);
        });
      });
    }

    test('full replacement',
      [{ insert: '111' }],
      [{ insert: '222' }, { delete: 3 }],
      [{ insert: '222' }]);
    test('insert at start',
      [{ insert: '111' }],
      [{ insert: '222' }],
      [{ insert: '222111' }]);
    test('append at end',
      [{ insert: '111' }],
      [{ retain: 3 }, { insert: '222' }],
      [{ insert: '111222' }]);
    test('surround',
      [{ insert: '111' }],
      [{ insert: '222' }, { retain: 3 }, { insert: '333' }],
      [{ insert: '222111333' }]);
    test('replace one middle bit',
      [{ insert: 'Drink more Slurm.' }],
      [{ retain: 6 }, { insert: 'LESS' }, { delete: 4 }],
      [{ insert: 'Drink LESS Slurm.' }]);
    test('replace two middle bits',
      [{ insert: '[[hello]] [[goodbye]]' }],
      [
        { retain: 2 }, { insert: 'YO' }, { delete: 5 }, { retain: 5 },
        { insert: 'LATER' }, { delete: 7 }
      ],
      [{ insert: '[[YO]] [[LATER]]' }]);
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

  describe('transform()', () => {
    it('should return an empty result from `EMPTY.transform(EMPTY, *)`', () => {
      const result1 = BodyDelta.EMPTY.transform(BodyDelta.EMPTY, false);
      assert.instanceOf(result1, BodyDelta);
      assert.deepEqual(result1.ops, []);

      const result2 = BodyDelta.EMPTY.transform(BodyDelta.EMPTY, true);
      assert.instanceOf(result2, BodyDelta);
      assert.deepEqual(result2.ops, []);
    });

    it('should reject calls when `other` is not an instance of the class', () => {
      const delta = BodyDelta.EMPTY;
      const other = 'blort';
      assert.throws(() => delta.transform(other, true));
    });

    it('should reject calls when `thisIsFirst` is not a boolean', () => {
      const delta = BodyDelta.EMPTY;
      assert.throws(() => delta.transform(delta, 'blort'));
    });

    it('should produce the expected transformations', () => {
      function test(d1, d2, expectedTrue, expectedFalse = expectedTrue) {
        d1 = new BodyDelta(d1);
        d2 = new BodyDelta(d2);

        const xformTrue  = d1.transform(d2, true);
        const xformFalse = d1.transform(d2, false);

        assert.deepEqual(xformTrue.ops,  expectedTrue);
        assert.deepEqual(xformFalse.ops, expectedFalse);
      }

      test(
        [{ insert: 'blort' }],
        [{ insert: 'blort' }],
        [{ retain: 5 }, { insert: 'blort' }],
        [{ insert: 'blort' }]);
      test(
        [{ delete: 10 }],
        [{ delete: 10 }],
        []);
      test(
        [{ delete: 10 }],
        [{ delete: 10 }, { insert: 'florp' }],
        [{ insert: 'florp' }]);
      test(
        [{ insert: '111' }],
        [{ insert: '222' }],
        [{ retain: 3 }, { insert: '222' }],
        [{ insert: '222' }]);
      test(
        [{ retain: 10 }, { insert: '111' }],
        [{ retain: 20 }, { insert: '222' }],
        [{ retain: 23 }, { insert: '222' }]);
    });
  });
});
