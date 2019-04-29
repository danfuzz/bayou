// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Codec } from '@bayou/codec';
import { MockCodable } from '@bayou/codec/mocks';
import { FrozenBuffer } from '@bayou/util-common';

describe('@bayou/codec/Codec.decode*()', () => {
  // Convenient bindings for `decode*()` and `encodeData()` to avoid a lot of
  // boilerplate.
  const codec            = new Codec();
  const decodeData       = (value) => { return codec.decodeData(value);       };
  const decodeJson       = (value) => { return codec.decodeJson(value);       };
  const decodeJsonBuffer = (value) => { return codec.decodeJsonBuffer(value); };
  const encodeData       = (value) => { return codec.encodeData(value);       };

  codec.registry.registerClass(MockCodable);

  describe('decodeData()', () => {
    it('should pass non-object values through as-is', () => {
      function test(value) {
        assert.strictEqual(decodeData(value), value);
      }

      test(37);
      test(true);
      test(false);
      test('Happy string');
      test(null);
    });

    it('should pass arrays with only data values through as-is', () => {
      function test(value) {
        assert.deepEqual(decodeData(value), value);
      }

      test([]);
      test([true]);
      test([1, false, 'x']);
      test([[[null]]]);
    });

    it('rejects plain objects not in "encoded instance" form', () => {
      assert.throws(() => decodeData({}));
      assert.throws(() => decodeData({ a: 123 }));
      assert.throws(() => decodeData({ foo: [], x: [] }));
    });

    it('rejects functions', () => {
      assert.throws(() => decodeData(function () { return true; }));
      assert.throws(() => decodeData(() => 123));
    });

    it('decodes an encoded array back to the original array', () => {
      const orig    = [1, 2, 'buckle my shoe'];
      const encoded = encodeData(orig);
      assert.deepEqual(decodeData(encoded), orig);
    });

    it('decodes an encoded `FrozenBuffer`s back to an equal instance', () => {
      const orig    = new FrozenBuffer('florp');
      const encoded = encodeData(orig);
      const decoded = decodeData(encoded);

      assert.deepEqual(decoded.string,     orig.string);
      assert.deepEqual(decoded.toBuffer(), orig.toBuffer());
    });

    it('decodes an encoded class instance as expected', () => {
      const apiObject = new MockCodable();
      const encoding  = encodeData(apiObject);
      const decoded   = decodeData(encoding);

      assert.instanceOf(decoded, apiObject.constructor);
    });
  });

  describe('decodeJson()', () => {
    it('decodes as expected', () => {
      assert.strictEqual(decodeJson('null'), null);
      assert.strictEqual(decodeJson('914'), 914);
      assert.deepEqual(decodeJson('{ "object": [["a", 10], ["b", 20]] }'), { a: 10, b: 20 });
    });
  });

  describe('decodeJsonBuffer()', () => {
    it('decodes as expected', () => {
      function bufAndDecode(s) {
        return decodeJsonBuffer(FrozenBuffer.coerce(s));
      }

      assert.strictEqual(bufAndDecode('null'), null);
      assert.strictEqual(bufAndDecode('914'), 914);
      assert.deepEqual(bufAndDecode('{ "object": [["a", 10], ["b", 20]] }'), { a: 10, b: 20 });
    });
  });
});
