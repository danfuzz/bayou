// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { ObjectUtil } from 'util-core';

describe('util-core/ObjectUtil', () => {
  describe('extract()', () => {
    it('should return the extracted properties', () => {
      function test(value, keys, expected) {
        const result = ObjectUtil.extract(value, keys);
        assert.isFrozen(result);
        assert.deepEqual(result, expected);
      }

      test({},                      [],         {});
      test({ a: 10 },               ['a'],      { a: 10 });
      test({ a: 10, b: 20, c: 30 }, ['a', 'c'], { a: 10, c: 30 });
      test([0, 1, 2, 3, 4, 5],      ['2', '4'], { '2': 2, '4': 4 });

      const value = new Map();
      value.blort = 'blort';
      test(value, ['blort'], { blort: 'blort' });
    });

    it('should fail if a property is missing', () => {
      function test(value, keys) {
        assert.throws(() => ObjectUtil.extract(value, keys));
      }

      test({},        ['x']);
      test({ a: 10 }, ['x']);
      test({ a: 10 }, ['a', 'x']);
    });
  });

  describe('hasOwnProperty()', () => {
    it('should return `true` when asked about an object\'s own propery', () => {
      const value = {};

      value.uniqueProperty = 'super neat!';

      assert.isTrue(ObjectUtil.hasOwnProperty(value, 'uniqueProperty'));
    });

    it('should return `false` when asked about a property in a parent', () => {
      const value = {};

      assert.isFalse(ObjectUtil.hasOwnProperty(value, 'toString'));
    });

    it('should return `false` when asked about an absent property', () => {
      const value = { x: 'this is a neat string!' };

      assert.isFalse(ObjectUtil.hasOwnProperty(value, 'floopty'));
    });
  });

  describe('isPlain()', () => {
    it('should return `true` for plain objects', () => {
      function test(value) {
        assert.isTrue(ObjectUtil.isPlain(value));
      }

      test({});
      test({ a: 10 });
      test({ a: 10, b: 20 });
      test({ [Symbol('blort')]: [1, 2, 3] });
    });

    it('should return `false` for non-plain objects', () => {
      function test(value) {
        assert.isFalse(ObjectUtil.isPlain(value));
      }

      test([]);
      test([1]);
      test(() => true);
      test(new Map());
      test({ get x() { return 10; } });
      test({ set x(v) { /*empty*/ } });
      test({ [Symbol('foo')]: 'foo' });
    });

    it('should return `false` for non-objects', () => {
      function test(value) {
        assert.isFalse(ObjectUtil.isPlain(value));
      }

      test(null);
      test(undefined);
      test(false);
      test(true);
      test('x');
      test(Symbol('x'));
      test(37);
    });
  });
});
