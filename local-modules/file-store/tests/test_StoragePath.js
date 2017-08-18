// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { StoragePath } from 'file-store';


describe('file-store/StoragePath', () => {
  describe('allPrefixes()', () => {
    it('should work as expected', () => {
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
    it('should accept valid paths', () => {
      function test(value) {
        assert.strictEqual(StoragePath.check(value), value);
      }

      test('/a');
      test('/1');
      test('/_');
      test('/abc123_ABC');
      test('/foo/bar');
      test('/foo/bar/999999');
      test('/florp/blort/like/TIMELINE_GOES_SIDEWAYS');
    });

    it('should reject invalid paths', () => {
      function test(value) {
        assert.throws(() => { StoragePath.check(value); });
      }

      // No components.
      test('');
      test('/');
      test('//');

      // Improper slash hygiene.
      test('a');
      test('a/');
      test('a/b');
      test('a//b');
      test('/a/');
      test('//a/');
      test('/a//');
      test('/a//b');

      // Invalid characters in components.
      test('/!');
      test('/~');
      test('/@');
      test('/#');
      test('/foo!');
      test('/bar~');
      test('/baz@');
      test('/blort#');
      test('/foo/!a');
      test('/bar/~b');
      test('/baz/@c');
      test('/blort/#d');
    });

    it('should reject non-strings', () => {
      function test(value) {
        assert.throws(() => { StoragePath.check(value); });
      }

      test(null);
      test(undefined);
      test(true);
      test(123.456);
      test([]);
      test(['/hello']);
      test({});
      test({ '/x': '/y' });
    });
  });

  describe('checkComponent()', () => {
    it('should accept valid components', () => {
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

    it('should reject invalid components', () => {
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

    it('should reject non-strings', () => {
      function test(value) {
        assert.throws(() => { StoragePath.checkComponent(value); });
      }

      test(null);
      test(undefined);
      test(true);
      test(123.456);
      test([]);
      test(['hello']);
      test({});
      test({ x: 'y' });
    });
  });

  describe('isPrefix()', () => {
    it('should return `true` for prefix relationships', () => {
      function test(prefix, path) {
        assert.isTrue(StoragePath.isPrefix(prefix, path));
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

    it('should return `false` for non-prefix relationships', () => {
      function test(prefix, path) {
        assert.isFalse(StoragePath.isPrefix(prefix, path));
      }

      test('/a', '/b');
      test('/a', '/b/a');
      test('/a/b', '/a');
      test('/a', '/aa');
      test('/a/b', '/a/bb');
    });
  });

  describe('join()', () => {
    it('should join as expected', () => {
      function test(value, expected) {
        assert.strictEqual(StoragePath.join(value), expected);
      }

      test(['a'], '/a');
      test(['a', 'b'], '/a/b');
      test(['blort', 'florp', 'like'], '/blort/florp/like');
    });
  });

  describe('orNull()', () => {
    it('should accept valid paths and `null`', () => {
      function test(value) {
        assert.doesNotThrow(() => { StoragePath.orNull(value); });
      }

      test('/a');
      test('/foo/bar');
      test(null);
    });

    it('should reject invalid paths', () => {
      function test(value) {
        assert.throws(() => { StoragePath.orNull(value); });
      }

      test('');
      test('/');
      test('a/');
      test('a//b');
      test('/!/x');
    });

    it('should reject non-strings', () => {
      function test(value) {
        assert.throws(() => { StoragePath.check(value); });
      }

      test(undefined);
      test(false);
      test(123.456);
      test([]);
      test(['/hello']);
      test({});
      test({ '/x': '/y' });
    });
  });

  describe('split()', () => {
    it('should split as expected', () => {
      function test(value, expected) {
        assert.deepEqual(StoragePath.split(value), expected);
      }

      test('/a', ['a']);
      test('/a/b', ['a', 'b']);
      test('/blort/florp/like', ['blort', 'florp', 'like']);
    });
  });
});
