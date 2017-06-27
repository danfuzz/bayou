// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { FrozenBuffer } from 'util-common';

import { Codec } from 'api-common';

import MockApiObject from './MockApiObject';

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

describe('api-common/Encoder', () => {
  // Convenient bindings for `encode()*` to avoid a lot of boilerplate.
  const codec            = Codec.theOne;
  const encode           = (value) => { return codec.encode(value);           };
  const encodeJson       = (value) => { return codec.encodeJson(value);       };
  const encodeJsonBuffer = (value) => { return codec.encodeJsonBuffer(value); };

  describe('encode', () => {
    it('should reject function values', () => {
      assert.throws(() => encode(function () { true; }));
    });

    it('should reject Symbols', () => {
      assert.throws(() => encode(Symbol('this better not work!')));
    });

    it('should reject undefined', () => {
      assert.throws(() => encode(undefined));
    });

    it('should pass through non-object values and null as-is', () => {
      assert.strictEqual(encode(37), 37);
      assert.strictEqual(encode(true), true);
      assert.strictEqual(encode(false), false);
      assert.strictEqual(encode('blort'), 'blort');
      assert.strictEqual(encode(null), null);
    });

    it('should pass through simple objects whose values are self-encoding as-is', () => {
      assert.deepEqual(encode({}), {});
      assert.deepEqual(encode({ a: 10 }), { a: 10 });
      assert.deepEqual(encode({ b: false }), { b: false });
      assert.deepEqual(encode({ c: 'yay', d: {} }), { c: 'yay', d: {} });
    });

    it('should reject arrays with index holes', () => {
      const value = [];

      value[1] = true;
      value[37] = true;

      assert.throws(() => encode(value));
    });

    it('should reject arrays with non-numeric properties', () => {
      const value = [];

      value['foo'] = 'bar';
      value['baz'] = 'floopty';

      assert.throws(() => encode(value));
    });

    it('should reject API objects with no API_NAME property', () => {
      const noApiName = new NoApiName();

      assert.throws(() => encode(noApiName));
    });

    it('should reject API objects with no toApi() method', () => {
      const noToApi = new NoToApi();

      assert.throws(() => encode(noToApi));
    });

    it('should accept objects with an API_NAME property and toApi() method', () => {
      const fakeObject = new MockApiObject();

      assert.doesNotThrow(() => encode(fakeObject));
    });
  });

  describe('encodeJson', () => {
    it('should produce a string', () => {
      assert.isString(encodeJson(null));
      assert.isString(encodeJson(914));
      assert.isString(encodeJson([1, 2, 3]));
    });

    it('should encode as expected', () => {
      assert.strictEqual(encodeJson(null), 'null');
      assert.strictEqual(encodeJson(914), '914');
      assert.strictEqual(encodeJson({ a: 10, b: 20 }), '{"a":10,"b":20}');
    });
  });

  describe('encodeJsonBuffer', () => {
    it('should produce a `FrozenBuffer`', () => {
      assert.instanceOf(encodeJsonBuffer(null), FrozenBuffer);
      assert.instanceOf(encodeJsonBuffer(914), FrozenBuffer);
      assert.instanceOf(encodeJsonBuffer([1, 2, 3]), FrozenBuffer);
    });

    it('should encode as expected', () => {
      assert.strictEqual(encodeJsonBuffer(null).string, 'null');
      assert.strictEqual(encodeJsonBuffer(914).string, '914');
      assert.strictEqual(encodeJsonBuffer({ a: 10, b: 20 }).string, '{"a":10,"b":20}');
    });
  });
});
