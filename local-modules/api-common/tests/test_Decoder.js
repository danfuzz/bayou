// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { before, describe, it } from 'mocha';

import { Decoder, Encoder, Registry } from 'api-common';
import { Mocks } from 'bayou-mocha';

before(() => {
  try {
    Registry.register(Mocks.apiObject().constructor);
  } catch (e) {
    // nothing to do here, the try/catch is just in case some other test
    // file has already registered the mock API object.
  }
});

describe('api-common.Decoder', () => {
  describe('#decode(value)', () => {
    it('should pass non-object values through as-is', () => {
      assert.equal(Decoder.decode(37), 37);
      assert.equal(Decoder.decode(true), true);
      assert.equal(Decoder.decode(false), false);
      assert.equal(Decoder.decode('Happy string'), 'Happy string');
      assert.isNull(Decoder.decode(null));
    });

    it('should accept simple objects', () => {
      // The tests here are of objects whose values all decode to themselves.
      assert.deepEqual(Decoder.decode({}), {});
      assert.deepEqual(Decoder.decode({ a: true, b: 'yo' }), { a: true, b: 'yo' });
    });

    it('should reject arrays whose first value is not a string', () => {
      assert.throws(() => Decoder.decode([]));
      assert.throws(() => Decoder.decode([1, 2, 3, '4 5 6']));
      assert.throws(() => Decoder.decode([true, 2, 3, '4 5 6']));
      assert.throws(() => Decoder.decode([null, 2, 3, '4 5 6']));
      assert.throws(() => Decoder.decode([[], 2, 3, '4 5 6']));
      assert.throws(() => Decoder.decode([() => true, 2, 3, '4 5 6']));
    });

    it('should reject functions', () => {
      assert.throws(() => Decoder.decode(function () { return true; }));
      assert.throws(() => Decoder.decode(() => 123));
    });

    it('should decode an encoded array back to the original array', () => {
      const orig = [1, 2, 'buckle my shoe'];
      const encoded = Encoder.encode(orig);
      assert.deepEqual(Decoder.decode(encoded), orig);
    });

    it('should convert propertly formatted values to an API object', () => {
      const apiObject = Mocks.apiObject();
      const encoding = Encoder.encode(apiObject);
      let decodedObject = null;

      assert.doesNotThrow(function () {
        decodedObject = Decoder.decode(encoding);
      });

      assert.instanceOf(decodedObject, apiObject.constructor);
    });
  });
});
