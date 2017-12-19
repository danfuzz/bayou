// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { before, describe, it } from 'mocha';

import { Codec } from 'codec';
import { MockCodable } from 'codec/mocks';
import { FrozenBuffer } from 'util-common';


describe('api-common/Codec.decode*()', () => {
  // Convenient bindings for `decode*()` and `encodeData()` to avoid a lot of
  // boilerplate.
  const codec            = Codec.theOne;
  const decodeData       = (value) => { return codec.decodeData(value);       };
  const decodeJson       = (value) => { return codec.decodeJson(value);       };
  const decodeJsonBuffer = (value) => { return codec.decodeJsonBuffer(value); };
  const encodeData       = (value) => { return codec.encodeData(value);       };

  before(() => {
    try {
      Codec.theOne.registerClass(MockCodable);
    } catch (e) {
      // nothing to do here, the try/catch is just in case some other test
      // file has already registered the mock class.
    }
  });

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

    it('should reject plain objects not in "encoded instance" form', () => {
      assert.throws(() => decodeData({}));
      assert.throws(() => decodeData({ a: 123 }));
      assert.throws(() => decodeData({ foo: [], x: [] }));
    });

    it('should reject functions', () => {
      assert.throws(() => decodeData(function () { return true; }));
      assert.throws(() => decodeData(() => 123));
    });

    it('should decode an encoded array back to the original array', () => {
      const orig = [1, 2, 'buckle my shoe'];
      const encoded = encodeData(orig);
      assert.deepEqual(decodeData(encoded), orig);
    });

    it('should convert propertly formatted values to a decoded instance', () => {
      const apiObject = new MockCodable();
      const encoding = encodeData(apiObject);
      let decodedObject = null;

      assert.doesNotThrow(() => {
        decodedObject = decodeData(encoding);
      });

      assert.instanceOf(decodedObject, apiObject.constructor);
    });
  });

  describe('decodeJson()', () => {
    it('should decode as expected', () => {
      assert.strictEqual(decodeJson('null'), null);
      assert.strictEqual(decodeJson('914'), 914);
      assert.deepEqual(decodeJson('{ "object": [["a", 10], ["b", 20]] }'), { a: 10, b: 20 });
    });
  });

  describe('decodeJsonBuffer()', () => {
    it('should decode as expected', () => {
      function bufAndDecode(s) {
        return decodeJsonBuffer(FrozenBuffer.coerce(s));
      }

      assert.strictEqual(bufAndDecode('null'), null);
      assert.strictEqual(bufAndDecode('914'), 914);
      assert.deepEqual(bufAndDecode('{ "object": [["a", 10], ["b", 20]] }'), { a: 10, b: 20 });
    });
  });
});
