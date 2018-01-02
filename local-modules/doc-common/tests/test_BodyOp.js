// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { BodyOp } from 'doc-common';
import { Functor } from 'util-common';

describe('doc-common/BodyOp', () => {
  describe('fromQuillForm()', () => {
    describe('invalid arguments', () => {
      function test(v) {
        it(`should reject: ${inspect(v)}`, () => {
          assert.throws(() => BodyOp.fromQuillForm(v));
        });
      }

      // Not even an object.
      test(undefined);
      test(null);
      test(false);
      test(123);
      test('insert');

      // Not a plain object.

      const notPlain = new Map();
      notPlain.insert = 'hello';
      test(notPlain);

      test([]);

      // Doesn't have one of the three essential bindings.
      test({});
      test({ attributes: { bold: true } });
      test({ attributes: { bold: true }, x: 10 });

      // Has more than one of the three essential bindings. (They're mutually
      // exclusive.)
      test({ insert: 'foo', delete: 10 });
      test({ insert: 'foo', retain: 10 });
      test({ delete: 10,    retain: 10 });

      // Has extra bindings.
      test({ blort: 'x', delete: 10 });
      test({ blort: 'x', insert: 'foo' });
      test({ blort: 'x', retain: 10 });

      // Delete shouldn't have `attributes`.
      test({ delete: 10, attributes: { bold: true } });
      test({ delete: 10, attributes: null });
      test({ delete: 10, attributes: undefined });

      // Empty attributes shouldn't be represented at all.
      test({ insert: 'xx', attributes: undefined });
      test({ insert: 'yy', attributes: null });
      test({ retain: 123, attributes: undefined });
      test({ retain: 123, attributes: null });

      // Wrong type for valid binding name.
      test({ delete: null });
      test({ delete: 'x' });
      test({ delete: [123] });
      test({ insert: null });
      test({ insert: undefined });
      test({ insert: 123 });
      test({ insert: ['foo'] });
      test({ retain: 'x' });
      test({ retain: [123] });
      test({ insert: 'x', attributes: false });
      test({ insert: 'x', attributes: 123 });
      test({ insert: 'x', attributes: ['x', 'y'] });
      test({ insert: 'x', attributes: new Map() });

      // Invalid embed form. (Must be a single-binding plain object.)
      test({ insert: {} });
      test({ insert: { x: 1, y: 2 } });
      test({ insert: new Map() });
    });
  });

  describe('fromQuillForm() / toQuillForm()', () => {
    function test(quillOp, bodyOp) {
      it(`should handle op: ${inspect(bodyOp)}`, () => {
        const bodyResult = BodyOp.fromQuillForm(quillOp);

        assert.instanceOf(bodyResult, BodyOp);
        assert.deepEqual(bodyResult.payload, bodyOp.payload);

        const quillResult = bodyOp.toQuillForm();

        assert.strictEqual(Object.getPrototypeOf(quillResult), Object.prototype);
        assert.deepEqual(quillResult, quillOp);
      });
    }

    const at1 = { x: 10, y: 20, z: 30 };
    const at2 = { p: [[[['p']]]], d: { d: 'd' }, q: true };

    const name1  = 'image';
    const value1 = 'https://example.com/some_url';
    const qemb1  = { [name1]: value1 };

    const name2  = 'blort';
    const value2 = { x: 'x', y: 'y' };
    const qemb2  = { [name2]: value2 };

    test({ delete: 1 },                      BodyOp.op_delete(1));
    test({ delete: 10000 },                  BodyOp.op_delete(10000));
    test({ insert: 'hello' },                BodyOp.op_text('hello'));
    test({ insert: 'yo', attributes: at1 },  BodyOp.op_text('yo', at1));
    test({ insert: qemb1 },                  BodyOp.op_embed(name1, value1));
    test({ insert: qemb2, attributes: at2 }, BodyOp.op_embed(name2, value2, at2));
    test({ retain: 123 },                    BodyOp.op_retain(123));
    test({ retain: 12345 },                  BodyOp.op_retain(12345));
    test({ retain: 1, attributes: at1 },     BodyOp.op_retain(1, at1));
  });

  describe('op_delete()', () => {
    it('should produce a value with expected payload', () => {
      const result = BodyOp.op_delete(123);
      assert.deepEqual(result.payload, new Functor('delete', 123));
    });
  });

  describe('op_embed()', () => {
    it('should produce a value with expected payload', () => {
      const attrib = { bold: true };

      const result1 = BodyOp.op_embed('blort', { x: 10 });
      assert.deepEqual(result1.payload, new Functor('embed', 'blort', { x: 10 }));

      const result2 = BodyOp.op_embed('florp', ['like'], attrib);
      assert.deepEqual(result2.payload, new Functor('embed', 'florp', ['like'], attrib));
    });

    it('should reject a non-identifier `type`', () => {
      assert.throws(() => BodyOp.op_embed('', 1));
      assert.throws(() => BodyOp.op_embed('*', 1));
      assert.throws(() => BodyOp.op_embed(null, 1));
      assert.throws(() => BodyOp.op_embed([], 1));
      assert.throws(() => BodyOp.op_embed(['x'], 1));
      assert.throws(() => BodyOp.op_embed({ florp: 'like' }, 1));
    });

    it('should reject a non-data `value`', () => {
      assert.throws(() => BodyOp.op_embed('x', new Map()));
      assert.throws(() => BodyOp.op_embed('x', { get x() { return 10; } }));
    });
  });

  describe('op_retain()', () => {
    it('should produce a value with expected payload', () => {
      const attrib = { header: 1 };

      const result1 = BodyOp.op_retain(123);
      assert.deepEqual(result1.payload, new Functor('retain', 123));

      const result2 = BodyOp.op_retain(456, attrib);
      assert.deepEqual(result2.payload, new Functor('retain', 456, attrib));
    });
  });

  describe('op_text()', () => {
    it('should produce a value with expected payload', () => {
      const attrib = { italic: true, bold: null };

      const result1 = BodyOp.op_text('florp');
      assert.deepEqual(result1.payload, new Functor('text', 'florp'));

      const result2 = BodyOp.op_text('like', attrib);
      assert.deepEqual(result2.payload, new Functor('text', 'like', attrib));
    });
  });

  describe('.props', () => {
    function test(op, expected) {
      it(`should provide expected bindings for: ${op}`, () => {
        const result = op.props;
        assert.isFrozen(result);
        assert.deepEqual(result, expected);
      });
    }

    const attrib = { italic: true, bold: null };

    test(BodyOp.op_delete(668),               { opName: 'delete', count: 668 });
    test(BodyOp.op_embed('x', ['y']),         { opName: 'embed', type: 'x', value: ['y'], attributes: null });
    test(BodyOp.op_embed('x', ['y'], null),   { opName: 'embed', type: 'x', value: ['y'], attributes: null });
    test(BodyOp.op_embed('x', ['y'], attrib), { opName: 'embed', type: 'x', value: ['y'], attributes: attrib });
    test(BodyOp.op_text('hello'),             { opName: 'text', text: 'hello', attributes: null });
    test(BodyOp.op_text('hello', null),       { opName: 'text', text: 'hello', attributes: null });
    test(BodyOp.op_text('hello', attrib),     { opName: 'text', text: 'hello', attributes: attrib });
    test(BodyOp.op_retain(5),                 { opName: 'retain', count: 5, attributes: null });
    test(BodyOp.op_retain(5, null),           { opName: 'retain', count: 5, attributes: null });
    test(BodyOp.op_retain(5, attrib),         { opName: 'retain', count: 5, attributes: attrib });
  });

  describe('equals()', () => {
    it('should return `true` when passed itself', () => {
      const op = BodyOp.op_text('florp');
      assert.isTrue(op.equals(op));
    });

    it('should return `true` when passed an identically-constructed value', () => {
      function test(method, ...args) {
        const op1 = BodyOp[method](...args);
        const op2 = BodyOp[method](...args);
        assert.isTrue(op1.equals(op2));
      }

      test('op_delete', 100);
      test('op_embed', 'florp', 'like');
      test('op_embed', 'florp', ['like', 'yeah']);
      test('op_embed', 'florp', 'like', { bold: true });
      test('op_text', 'foo', { italic: true });
      test('op_text', 'foo');
      test('op_text', 'foo', { italic: true });
      test('op_retain', 100);
      test('op_retain', 100, { header: 3 });
    });

    it('should return `false` when type or any field differs', () => {
      function test(op1, op2) {
        assert.isFalse(op1.equals(op2));
        assert.isFalse(op2.equals(op1));
      }

      const at1  = { bold: true };
      const at2  = { bold: true, italic: true };

      test(BodyOp.op_delete(100),        BodyOp.op_retain(100));
      test(BodyOp.op_delete(100),        BodyOp.op_delete(101));
      test(BodyOp.op_embed('x', 1),      BodyOp.op_embed('y', 1));
      test(BodyOp.op_embed('x', 1),      BodyOp.op_embed('x', 2));
      test(BodyOp.op_embed('x', 1, at1), BodyOp.op_embed('x', 1));
      test(BodyOp.op_embed('x', 1, at1), BodyOp.op_embed('x', 1, at2));
      test(BodyOp.op_text('x'),          BodyOp.op_text('y'));
      test(BodyOp.op_text('x', at1),     BodyOp.op_text('x'));
      test(BodyOp.op_text('x', at1),     BodyOp.op_text('x', at2));
      test(BodyOp.op_retain(100),        BodyOp.op_retain(900));
      test(BodyOp.op_retain(1, at1),     BodyOp.op_retain(1));
      test(BodyOp.op_retain(1, at1),     BodyOp.op_retain(1, at2));
    });

    it('should return `false` when passed a non-instance', () => {
      const op = BodyOp.op_text('zorch');

      assert.isFalse(op.equals(undefined));
      assert.isFalse(op.equals(null));
      assert.isFalse(op.equals('not an op'));
      assert.isFalse(op.equals(['also', 'not', 'an', 'op']));
      assert.isFalse(op.equals({ not: 'an op' }));
    });
  });

  describe('isInsert()', () => {
    it('should return `true` for inserts', () => {
      function test(v) {
        assert.isTrue(v.isInsert());
      }

      test(BodyOp.op_embed('x', 1));
      test(BodyOp.op_embed('x', 1), { bold: true });
      test(BodyOp.op_text('foo'));
      test(BodyOp.op_text('foo', { bold: true }));
    });

    it('should return `false` for non-inserts', () => {
      function test(v) {
        assert.isFalse(v.isInsert());
      }

      test(BodyOp.op_delete(1));
      test(BodyOp.op_retain(1));
    });
  });
});
