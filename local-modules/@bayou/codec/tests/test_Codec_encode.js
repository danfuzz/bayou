// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Codec, ConstructorCall } from '@bayou/codec';
import { MockCodable } from '@bayou/codec/mocks';
import { FrozenBuffer } from '@bayou/util-common';

describe('@bayou/codec/Codec.encode*()', () => {
  // Convenient bindings for `encode*()` to avoid a lot of boilerplate.
  const codec            = new Codec();
  const encodeData       = (value) => { return codec.encodeData(value);       };
  const encodeJson       = (value) => { return codec.encodeJson(value);       };
  const encodeJsonBuffer = (value) => { return codec.encodeJsonBuffer(value); };

  codec.registry.registerClass(MockCodable);

  describe('encodeData()', () => {
    it('rejects function values', () => {
      assert.throws(() => encodeData(() => 1));
    });

    it('rejects Symbols', () => {
      assert.throws(() => encodeData(Symbol('this better not work!')));
    });

    it('rejects undefined', () => {
      assert.throws(() => encodeData(undefined));
    });

    it('should pass through non-object values and null as-is', () => {
      function test(value) {
        assert.strictEqual(encodeData(value), value);
      }

      test(37);
      test(true);
      test(false);
      test('blort');
      test(null);
    });

    it('should pass through arrays with just data elements as-is', () => {
      function test(value) {
        assert.deepEqual(encodeData(value), value);
      }

      test([]);
      test([true]);
      test([1, false, 'x']);
      test([[[null]]]);
    });

    it('rejects arrays with index holes', () => {
      const value = [];

      value[1] = true;
      value[37] = true;

      assert.throws(() => encodeData(value));
    });

    it('rejects arrays with non-numeric properties', () => {
      const value = [];

      value['foo'] = 'bar';
      value['baz'] = 'floopty';

      assert.throws(() => encodeData(value));
    });

    it('accepts plain objects and encode as a tagged entries array', () => {
      function test(value) {
        const expect = ConstructorCall.from('object', ...Object.entries(value));
        assert.deepEqual(encodeData(value), expect);
      }

      test({});
      test({ a: 10 });
      test({ b: false });
      test({ c: 'yay', d: [1, 2, 3] });
    });

    it('should sort plain object keys in encoded form', () => {
      const orig   = { d: [1, 2, 3], a: { c: 'cx', b: 'bx' } };
      const expect = ConstructorCall.from('object',
        ['a', ConstructorCall.from('object', ['b', 'bx'], ['c', 'cx'])],
        ['d', [1, 2, 3]]
      );

      assert.deepEqual(encodeData(orig), expect);
    });

    it('accepts `FrozenBuffer`s and encode as a single base-64 string argument', () => {
      const orig   = new FrozenBuffer('florp');
      const expect = ConstructorCall.from('buf', 'ZmxvcnA=');

      assert.deepEqual(encodeData(orig), expect);
    });

    it('rejects objects with no `deconstruct()` method', () => {
      class NoDeconstruct {
        get CODEC_TAG() {
          return 'NoDeconstruct';
        }
      }

      const noDeconstruct = new NoDeconstruct();

      assert.throws(() => encodeData(noDeconstruct));
    });

    it('accepts objects with a `CODEC_TAG` property and `deconstruct()` method', () => {
      const fakeObject = new MockCodable();

      assert.doesNotThrow(() => encodeData(fakeObject));
    });
  });

  describe('encodeJson()', () => {
    it('should produce a string', () => {
      assert.isString(encodeJson(null));
      assert.isString(encodeJson(914));
      assert.isString(encodeJson([1, 2, 3]));
    });

    it('should encode as expected', () => {
      assert.strictEqual(encodeJson(null), 'null');
      assert.strictEqual(encodeJson(914), '914');
      assert.strictEqual(encodeJson({ a: 10, b: 20 }), '{"object":[["a",10],["b",20]]}');
    });
  });

  describe('encodeJsonBuffer()', () => {
    it('should produce a `FrozenBuffer`', () => {
      assert.instanceOf(encodeJsonBuffer(null), FrozenBuffer);
      assert.instanceOf(encodeJsonBuffer(914), FrozenBuffer);
      assert.instanceOf(encodeJsonBuffer([1, 2, 3]), FrozenBuffer);
    });

    it('should encode as expected', () => {
      assert.strictEqual(encodeJsonBuffer(null).string, 'null');
      assert.strictEqual(encodeJsonBuffer(914).string, '914');
      assert.strictEqual(encodeJsonBuffer({ a: 10, b: 20 }).string, '{"object":[["a",10],["b",20]]}');
    });
  });
});
