// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Encoder } from 'api-common';
import { Mocks } from 'bayou-mocha';

class NoApiName {
  toApi() {
    return 'NoApiName!';
  }
}

class NoToApi {
  constructor() {
    this.API_NAME = 'NoToApi';
  }
}

describe('api-common.Encoder', () => {
  describe('#encode(value)', () => {
    it('should reject function values', () => {
      assert.throws(() => Encoder.encode(function () { true; }));
    });

    it('should reject Symbols', () => {
      assert.throws(() => Encoder.encode(Symbol('this better not work!')));
    });

    it('should reject undefined', () => {
      assert.throws(() => Encoder.encode(undefined));
    });

    it('should pass through non-object values and null as-is', () => {
      assert.equal(Encoder.encode(37), 37);
      assert.equal(Encoder.encode(true), true);
      assert.equal(Encoder.encode(false), false);
      assert.equal(Encoder.encode('blort'), 'blort');
      assert.equal(Encoder.encode(null), null);
    });

    it('should pass through simple objects whose values are self-encoding as-is', () => {
      assert.deepEqual(Encoder.encode({}), {});
      assert.deepEqual(Encoder.encode({ a: 10 }), { a: 10 });
      assert.deepEqual(Encoder.encode({ b: false }), { b: false });
      assert.deepEqual(Encoder.encode({ c: 'yay', d: {} }), { c: 'yay', d: {} });
    });

    it('should reject arrays with index holes', () => {
      const value = [];

      value[1] = true;
      value[37] = true;

      assert.throws(() => Encoder.encode(value));
    });

    it('should reject arrays with non-numeric properties', () => {
      const value = [];

      value['foo'] = 'bar';
      value['baz'] = 'floopty';

      assert.throws(() => Encoder.encode(value));
    });

    it('should reject API objects with no API_NAME property', () => {
      const noApiName = new NoApiName();

      assert.throws(() => Encoder.encode(noApiName));
    });

    it('should reject API objects with no toApi() method', () => {
      const noToApi = new NoToApi();

      assert.throws(() => Encoder.encode(noToApi));
    });

    it('should accept objects with an API_NAME property and toApi() method', () => {
      const fakeObject = Mocks.apiObject();

      assert.doesNotThrow(() => Encoder.encode(fakeObject));
    });
  });
});
