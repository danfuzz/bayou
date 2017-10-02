// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import MockDelta from './MockDelta';

describe('doc-common/BaseDelta', () => {
  describe('.EMPTY', () => {
    const EMPTY = MockDelta.EMPTY;

    it('should be an instance of the subclass', () => {
      assert.instanceOf(EMPTY, MockDelta);
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

  describe('constructor()', () => {
    describe('valid arguments', () => {
      const values = [
        [],
        MockDelta.VALID_OPS,
        MockDelta.NOT_DOCUMENT_OPS,
        [MockDelta.makeOp('x'), MockDelta.makeOp('y')]
      ];

      for (const v of values) {
        it(`should succeed for: ${inspect(v)}`, () => {
          new MockDelta(v);
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
        new Map(),
        [null],
        [undefined],
        ['x'],
        [1, 2, 3],
        MockDelta.INVALID_OPS
      ];

      for (const v of values) {
        it(`should fail for: ${inspect(v)}`, () => {
          assert.throws(() => new MockDelta(v));
        });
      }
    });
  });

  describe('isDocument()', () => {
    describe('`true` cases', () => {
      const values = [
        [],
        MockDelta.VALID_OPS
      ];

      for (const v of values) {
        it(`should return \`true\` for: ${inspect(v)}`, () => {
          assert.isTrue(new MockDelta(v).isDocument());
        });
      }
    });

    describe('`false` cases', () => {
      assert.isFalse(new MockDelta(MockDelta.NOT_DOCUMENT_OPS).isDocument());
    });
  });

  describe('isEmpty()', () => {
    describe('valid empty values', () => {
      const values = [
        new MockDelta([]),
        MockDelta.EMPTY,
      ];

      for (const v of values) {
        it(`should return \`true\` for: ${inspect(v)}`, () => {
          assert.isTrue(v.isEmpty());
        });
      }
    });

    describe('valid non-empty values', () => {
      const values = [
        MockDelta.VALID_OPS,
        MockDelta.NOT_DOCUMENT_OPS
      ];

      for (const v of values) {
        it(`should return \`false\` for: ${inspect(v)}`, () => {
          const delta = new MockDelta(v);
          assert.isFalse(delta.isEmpty());
        });
      }
    });
  });
});
