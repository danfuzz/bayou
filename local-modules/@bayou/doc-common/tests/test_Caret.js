// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Caret, CaretDelta, CaretOp } from '@bayou/doc-common';

/**
 * Convenient caret constructor, which takes positional parameters.
 *
 * @param {string} sessionId Session ID.
 * @param {Int} index Start caret position.
 * @param {Int} length Selection length.
 * @param {string} color Highlight color.
 * @param {string} authorId Author ID.
 * @returns {Caret} Appropriately-constructed caret.
 */
function newCaret(sessionId, index, length, color, authorId) {
  return new Caret(sessionId, { index, length, color, authorId });
}

const caret1 = newCaret('session-1', 1, 0,  '#111111', 'author-1');
const caret2 = newCaret('session-2', 2, 6,  '#222222', 'author-2');
const caret3 = newCaret('session-3', 3, 99, '#333333', 'third-author');

describe('@bayou/doc-common/Caret', () => {
  describe('compose()', () => {
    it('should produce an equal instance when passed an empty delta', () => {
      let which = 0;
      function test(caret) {
        which++;
        const result = caret.compose(CaretDelta.EMPTY);
        assert.isTrue(result.equals(caret), `#${which}`);
      }

      test(caret1);
      test(caret2);
      test(caret3);
    });

    it('should update `authorId` given the appropriate op', () => {
      const op     = CaretOp.op_setField(caret1.sessionId, 'authorId', 'boop');
      const result = caret1.compose(new CaretDelta([op]));

      assert.strictEqual(result.authorId, 'boop');
    });

    it('should update `index` given the appropriate op', () => {
      const op     = CaretOp.op_setField(caret1.sessionId, 'index', 99999);
      const result = caret1.compose(new CaretDelta([op]));

      assert.strictEqual(result.index, 99999);
    });

    it('should update `length` given the appropriate op', () => {
      const op     = CaretOp.op_setField(caret1.sessionId, 'length', 99999);
      const result = caret1.compose(new CaretDelta([op]));

      assert.strictEqual(result.length, 99999);
    });

    it('should update `color` given the appropriate op', () => {
      const op     = CaretOp.op_setField(caret1.sessionId, 'color', '#aabbcc');
      const result = caret1.compose(new CaretDelta([op]));

      assert.strictEqual(result.color, '#aabbcc');
    });

    it('should update `revNum` given the appropriate op', () => {
      const op     = CaretOp.op_setField(caret1.sessionId, 'revNum', 12345);
      const result = caret1.compose(new CaretDelta([op]));

      assert.strictEqual(result.revNum, 12345);
    });

    it('should refuse to compose if given a non-matching session ID', () => {
      const op = CaretOp.op_setField(caret2.sessionId, 'index', 55);

      assert.throws(() => { caret1.compose(new CaretDelta([op])); });
    });
  });

  describe('diff()', () => {
    it('should produce an empty diff when passed itself', () => {
      const result = caret1.diff(caret1);

      assert.instanceOf(result, CaretDelta);
      assert.deepEqual(result.ops, []);
    });

    it('should refuse to diff if given a non-matching session ID', () => {
      assert.throws(() => { caret1.diff(caret2); });
    });

    it('should result in an `index` diff if that in fact changes', () => {
      const older   = caret1;
      const op      = CaretOp.op_setField(older.sessionId, 'index', 99999);
      const newer   = older.compose(new CaretDelta([op]));
      const diffOps = older.diff(newer).ops;

      assert.strictEqual(diffOps.length, 1);
      assert.deepEqual(diffOps[0], op);
    });
  });

  describe('diffFields()', () => {
    it('should produce an empty diff when passed itself', () => {
      const result = caret1.diffFields(caret1, 'florp');

      assert.instanceOf(result, CaretDelta);
      assert.deepEqual(result.ops, []);
    });

    it('should diff fields even if given a non-matching session ID', () => {
      assert.doesNotThrow(() => { caret1.diffFields(caret2, 'florp'); });
    });

    it('should result in an `index` diff if that in fact changes', () => {
      const older   = caret1;
      const op      = CaretOp.op_setField(older.sessionId, 'index', 99999);
      const newer   = older.compose(new CaretDelta([op]));
      const diffOps = older.diffFields(newer, older.sessionId).ops;

      assert.strictEqual(diffOps.length, 1);
      assert.deepEqual(diffOps[0], op);
    });

    it('should result in a `length` diff if that in fact changes', () => {
      const older   = caret1;
      const op      = CaretOp.op_setField(older.sessionId, 'length', 99999);
      const newer   = older.compose(new CaretDelta([op]));
      const diffOps = older.diffFields(newer, older.sessionId).ops;

      assert.strictEqual(diffOps.length, 1);
      assert.deepEqual(diffOps[0], op);
    });

    it('should result in a `color` diff if that in fact changes', () => {
      const older   = caret1;
      const op      = CaretOp.op_setField(older.sessionId, 'color', '#abcdef');
      const newer   = older.compose(new CaretDelta([op]));
      const diffOps = older.diffFields(newer, older.sessionId).ops;

      assert.strictEqual(diffOps.length, 1);
      assert.deepEqual(diffOps[0], op);
    });
  });

  describe('equals()', () => {
    it('should return `true` when passed itself', () => {
      assert.isTrue(caret1.equals(caret1));
      assert.isTrue(caret2.equals(caret2));
      assert.isTrue(caret3.equals(caret3));
    });

    it('should return `true` when passed an identically-constructed value', () => {
      const same = caret1.compose(CaretDelta.EMPTY);
      assert.notStrictEqual(caret1, same);
      assert.isTrue(caret1.equals(same));
    });

    it('should return `false` when session IDs differ', () => {
      const c1 = newCaret('x', 1, 2, '#000011', 'some-author');
      const c2 = newCaret('y', 1, 2, '#000011', 'some-author');
      assert.isFalse(c1.equals(c2));
    });

    it('should return `false` when any field differs', () => {
      const c1 = caret1;
      let   c2, op;

      op = CaretOp.op_setField(c1.sessionId, 'index', 99999);
      c2 = c1.compose(new CaretDelta([op]));
      assert.isFalse(c1.equals(c2));

      op = CaretOp.op_setField(c1.sessionId, 'length', 99999);
      c2 = c1.compose(new CaretDelta([op]));
      assert.isFalse(c1.equals(c2));

      op = CaretOp.op_setField(c1.sessionId, 'color', '#999999');
      c2 = c1.compose(new CaretDelta([op]));
      assert.isFalse(c1.equals(c2));

      op = CaretOp.op_setField(c1.sessionId, 'authorId', 'zagnut');
      c2 = c1.compose(new CaretDelta([op]));
      assert.isFalse(c1.equals(c2));
    });

    it('should return `false` when passed a non-caret', () => {
      const caret = newCaret('x', 1, 2, '#000011', 'blorp');

      assert.isFalse(caret.equals(undefined));
      assert.isFalse(caret.equals(null));
      assert.isFalse(caret.equals('not a caret'));
      assert.isFalse(caret.equals(['also', 'not', 'a', 'caret']));
    });
  });
});
