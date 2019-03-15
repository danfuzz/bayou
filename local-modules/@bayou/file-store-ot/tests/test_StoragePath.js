// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { StoragePath } from '@bayou/file-store-ot';

/** {array<string>} List of valid paths. */
const VALID_PATHS = [
  '/a',
  '/1',
  '/_',
  '/abc123_ABC',
  '/foo/bar',
  '/foo/bar/999999',
  '/florp/blort/like/TIMELINE_GOES_SIDEWAYS'
];

/** {array<string>} List of invalid paths. */
const INVALID_PATHS = [
  // No components.
  '',
  '/',
  '//',

  // Improper slash hygiene.
  'a',
  'a/',
  'a/b',
  'a//b',
  '/a/',
  '//a/',
  '/a//',
  '/a//b',

  // Invalid characters in components.
  '/!',
  '/~',
  '/@',
  '/#',
  '/foo!',
  '/bar~',
  '/baz@',
  '/blort#',
  '/foo/!a',
  '/bar/~b',
  '/baz/@c',
  '/blort/#d'
];

/** {array<*>} List of non-strings to check as paths (or path components). */
const NON_STRINGS = [
  null,
  undefined,
  true,
  123.456,
  [],
  ['/hello'],
  {},
  { '/x': '/y' }
];

describe('@bayou/file-store-ot/StoragePath', () => {
  describe('allPrefixes()', () => {
    it('works as expected', () => {
      function test(value, expected) {
        assert.deepEqual(StoragePath.allPrefixes(value), expected);
      }

      test('/foo', []);
      test('/foo/bar', ['/foo']);
      test('/foo/bar/baz', ['/foo', '/foo/bar']);
      test('/foo/bar/baz/blort/florp', ['/foo', '/foo/bar', '/foo/bar/baz', '/foo/bar/baz/blort']);
    });
  });

  describe('check()', () => {
    it('accepts valid paths', () => {
      for (const value of VALID_PATHS) {
        assert.strictEqual(StoragePath.check(value), value);
      }
    });

    it('rejects invalid paths', () => {
      for (const value of INVALID_PATHS) {
        assert.throws(() => { StoragePath.check(value); });
      }
    });

    it('rejects non-strings', () => {
      for (const value of NON_STRINGS) {
        assert.throws(() => { StoragePath.check(value); });
      }
    });
  });

  describe('checkComponent()', () => {
    it('accepts valid components', () => {
      function test(value) {
        assert.strictEqual(StoragePath.checkComponent(value), value);
      }

      test('a');
      test('1');
      test('_');
      test('abc123_ABC');
      test('foobar');
      test('999999');
      test('TIMELINE_GOES_SIDEWAYS');
    });

    it('rejects invalid components', () => {
      function test(value) {
        assert.throws(() => { StoragePath.checkComponent(value); });
      }

      test('');
      test('/');
      test('~');
      test('@');
      test('#');
      test('/foo');
      test('foo!');
      test('bar~');
      test('baz@');
      test('blort#');
      test('/foo/a');
      test('bar~b');
      test('baz@c');
      test('blort#d');
    });

    it('rejects non-strings', () => {
      for (const value of NON_STRINGS) {
        assert.throws(() => { StoragePath.checkComponent(value); });
      }
    });
  });

  describe('getIndex()', () => {
    it('returns the index from a valid index-bearing path', () => {
      function test(value, expect) {
        const result = StoragePath.getIndex(value);
        assert.strictEqual(result, expect, value);
      }

      for (let i = 0; i < 1000; i++) {
        if (i > 25) {
          i += 123;
        }

        test(`/${i}`, i);
        test(`/florp/${i}`, i);
        test(`/a/b/c/${i}`, i);
        test(`/a/1/c/${i}`, i);
      }
    });

    it('rejects non-index-bearing paths', () => {
      function test(value) {
        assert.throws(() => StoragePath.getIndex(value), /badValue/);
      }

      // Nothing even vaguely index-like.
      test('/foo');
      test('/foo/bar');
      test('/foo/bar/baz');

      // Invalid index forms.
      test('/00');
      test('/01');
      test('/x/00');
      test('/x/09');

      // Last component must be the index.
      test('/0/x');
      test('/1/x');
      test('/x/0/x');
      test('/x/1/x');
    });

    it('rejects entirely invalid path arguments', () => {
      for (const value of [...INVALID_PATHS, ...NON_STRINGS]) {
        assert.throws(() => StoragePath.getIndex(value), /badValue/);
      }
    });
  });

  describe('isInstance()', () => {
    it('returns `true` for valid paths', () => {
      for (const value of VALID_PATHS) {
        assert.isTrue(StoragePath.isInstance(value), value);
      }
    });

    it('returns `false` for invalid paths', () => {
      for (const value of INVALID_PATHS) {
        assert.isFalse(StoragePath.isInstance(value), value);
      }
    });

    it('returns `false` for non-strings', () => {
      for (const value of NON_STRINGS) {
        assert.isFalse(StoragePath.isInstance(value), value);
      }
    });
  });

  describe('isPrefix*()', () => {
    // Common tests for both `isPrefix*()` methods, because they only differ in
    // how `===` arguments are treated.
    function outerTest(methodName, equalExpectation) {
      const func = (prefix, path) => {
        return StoragePath[methodName](prefix, path);
      };

      it('returns `true` for prefix relationships', () => {
        function test(prefix, path) {
          assert.isTrue(func(prefix, path));
        }

        test('/a', '/a/b');
        test('/a', '/a/b/c');
        test('/a', '/a/b/c/d');
        test('/a', '/a/b/c/d/e');
        test('/a', '/a/b/c/d/e/f');
        test('/blort/florp', '/blort/florp/a');
        test('/blort/florp', '/blort/florp/aa');
        test('/blort/florp', '/blort/florp/aa/b');
        test('/blort/florp', '/blort/florp/aa/bb');
      });

      it(`returns \`${equalExpectation}\` when the two values are equal`, () => {
        function test(prefix, path) {
          assert.strictEqual(func(prefix, path), equalExpectation);
        }

        test('/a',      '/a');
        test('/ab',     '/ab');
        test('/x/y/zz', '/x/y/zz');
      });

      it('returns `false` for non-prefix, non-equal relationships', () => {
        function test(prefix, path) {
          assert.isFalse(func(prefix, path));
        }

        test('/a',   '/aa');
        test('/aa',  '/a');
        test('/a',   '/b');
        test('/a',   '/b/a');
        test('/a/b', '/a');
        test('/ax',  '/axb');
        test('/ax',  '/axb/c');
        test('/a/b', '/a/bb');
      });

      it('throws an error if either argument is not a valid absolute path', () => {
        function test(value) {
          assert.throws(() => func('/x', value));
          assert.throws(() => func(value, '/x'));
          assert.throws(() => func(value, value));
        }

        // Non-strings.
        test(null);
        test(undefined);
        test(false);
        test(123);
        test(new Map());
        test(['x']);
        test({ x: 10 });

        // Not valid absolute path syntax.
        test('');
        test('foo');
        test('foo/');
        test('/boo$');
        test('/@');
        test('/!x');
        test('florp/');
        test('/florp/');
        test('x/y');
        test('x/y/');
      });
    }

    describe('isPrefix()', () => {
      outerTest('isPrefix', false);
    });

    describe('isPrefixOrSame()', () => {
      outerTest('isPrefixOrSame', true);
    });
  });

  describe('join()', () => {
    it('joins as expected', () => {
      function test(value, expected) {
        assert.strictEqual(StoragePath.join(value), expected);
      }

      test(['a'], '/a');
      test(['a', 'b'], '/a/b');
      test(['blort', 'florp', 'like'], '/blort/florp/like');
    });
  });

  describe('orNull()', () => {
    it('accepts `null`', () => {
      assert.strictEqual(StoragePath.orNull(null), null);
    });

    it('accepts valid paths', () => {
      for (const value of VALID_PATHS) {
        assert.strictEqual(StoragePath.orNull(value), value);
      }
    });

    it('rejects invalid paths', () => {
      for (const value of INVALID_PATHS) {
        assert.throws(() => { StoragePath.orNull(value); });
      }
    });

    it('rejects non-null non-strings', () => {
      for (const value of NON_STRINGS) {
        if (value === null) {
          continue;
        }
        assert.throws(() => { StoragePath.orNull(value); });
      }
    });
  });

  describe('split()', () => {
    it('splits as expected', () => {
      function test(value, expected) {
        assert.deepEqual(StoragePath.split(value), expected);
      }

      test('/a', ['a']);
      test('/a/b', ['a', 'b']);
      test('/blort/florp/like', ['blort', 'florp', 'like']);
    });
  });
});
