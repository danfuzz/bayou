// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { before, describe, it } from 'mocha';
import { FrozenBuffer } from 'util-common';

import { Codec } from 'api-common';

import MockApiObject from './MockApiObject';

describe('api-common/Decoder', () => {
  // Convenient bindings for `decode*()` and `encodeData()` to avoid a lot of
  // boilerplate.
  const codec            = Codec.theOne;
  const decodeData       = (value) => { return codec.decodeData(value);       };
  const decodeJson       = (value) => { return codec.decodeJson(value);       };
  const decodeJsonBuffer = (value) => { return codec.decodeJsonBuffer(value); };
  const encodeData       = (value) => { return codec.encodeData(value);       };

  before(() => {
    try {
      Codec.theOne.registerClass(MockApiObject);
    } catch (e) {
      // nothing to do here, the try/catch is just in case some other test
      // file has already registered the mock API object.
    }
  });

  describe('decodeData', () => {
    it('should pass non-object values through as-is', () => {
      assert.strictEqual(decodeData(37), 37);
      assert.strictEqual(decodeData(true), true);
      assert.strictEqual(decodeData(false), false);
      assert.strictEqual(decodeData('Happy string'), 'Happy string');
      assert.isNull(decodeData(null));
    });

    it('should accept simple objects', () => {
      // The tests here are of objects whose values all decode to themselves.
      assert.deepEqual(decodeData({}), {});
      assert.deepEqual(decodeData({ a: true, b: 'yo' }), { a: true, b: 'yo' });
    });

    it('should reject arrays whose first value is not a string', () => {
      assert.throws(() => decodeData([]));
      assert.throws(() => decodeData([1, 2, 3, '4 5 6']));
      assert.throws(() => decodeData([true, 2, 3, '4 5 6']));
      assert.throws(() => decodeData([null, 2, 3, '4 5 6']));
      assert.throws(() => decodeData([[], 2, 3, '4 5 6']));
      assert.throws(() => decodeData([() => true, 2, 3, '4 5 6']));
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

    it('should convert propertly formatted values to an API object', () => {
      const apiObject = new MockApiObject();
      const encoding = encodeData(apiObject);
      let decodedObject = null;

      assert.doesNotThrow(() => {
        decodedObject = decodeData(encoding);
      });

      assert.instanceOf(decodedObject, apiObject.constructor);
    });
  });

  describe('decodeJson', () => {
    it('should decode as expected', () => {
      assert.strictEqual(decodeJson('null'), null);
      assert.strictEqual(decodeJson('914'), 914);
      assert.deepEqual(decodeJson('{"a":10,"b":20}'), { a: 10, b: 20 });
    });
  });

  describe('decodeJsonBuffer', () => {
    it('should decode as expected', () => {
      function bufAndDecode(s) {
        return decodeJsonBuffer(FrozenBuffer.coerce(s));
      }

      assert.strictEqual(bufAndDecode('null'), null);
      assert.strictEqual(bufAndDecode('914'), 914);
      assert.deepEqual(bufAndDecode('{"a":10,"b":20}'), { a: 10, b: 20 });
    });
  });
});
