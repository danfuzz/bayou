// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { FrozenBuffer } from 'util-common';

import { Codec } from 'api-common';

import MockApiObject from './MockApiObject';

class NoApiTag {
  toApi() {
    return 'NoApiTag!';
  }
}

class NoToApi {
  constructor() {
    this.API_TAG = 'NoToApi';
  }
}

describe('api-common/Encoder', () => {
  // Convenient bindings for `encode*()` to avoid a lot of boilerplate.
  const codec            = Codec.theOne;
  const encodeData       = (value) => { return codec.encodeData(value);       };
  const encodeJson       = (value) => { return codec.encodeJson(value);       };
  const encodeJsonBuffer = (value) => { return codec.encodeJsonBuffer(value); };

  describe('encodeData', () => {
    it('should reject function values', () => {
      assert.throws(() => encodeData(() => 1));
    });

    it('should reject Symbols', () => {
      assert.throws(() => encodeData(Symbol('this better not work!')));
    });

    it('should reject undefined', () => {
      assert.throws(() => encodeData(undefined));
    });

    it('should pass through non-object values and null as-is', () => {
      assert.strictEqual(encodeData(37), 37);
      assert.strictEqual(encodeData(true), true);
      assert.strictEqual(encodeData(false), false);
      assert.strictEqual(encodeData('blort'), 'blort');
      assert.strictEqual(encodeData(null), null);
    });

    it('should pass through simple objects whose values are self-encoding as-is', () => {
      assert.deepEqual(encodeData({}), {});
      assert.deepEqual(encodeData({ a: 10 }), { a: 10 });
      assert.deepEqual(encodeData({ b: false }), { b: false });
      assert.deepEqual(encodeData({ c: 'yay', d: {} }), { c: 'yay', d: {} });
    });

    it('should reject arrays with index holes', () => {
      const value = [];

      value[1] = true;
      value[37] = true;

      assert.throws(() => encodeData(value));
    });

    it('should reject arrays with non-numeric properties', () => {
      const value = [];

      value['foo'] = 'bar';
      value['baz'] = 'floopty';

      assert.throws(() => encodeData(value));
    });

    it('should reject API objects with no API_TAG property', () => {
      const NoApiTag = new NoApiTag();

      assert.throws(() => encodeData(NoApiTag));
    });

    it('should reject API objects with no toApi() method', () => {
      const noToApi = new NoToApi();

      assert.throws(() => encodeData(noToApi));
    });

    it('should accept objects with an API_TAG property and toApi() method', () => {
      const fakeObject = new MockApiObject();

      assert.doesNotThrow(() => encodeData(fakeObject));
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
