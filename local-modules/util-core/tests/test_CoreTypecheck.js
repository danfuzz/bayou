// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { CoreTypecheck } from 'util-core';

import Assert from './Assert';

/** {array<string>} Strings to use as test cases. */
const STRING_CASES = [
  '',
  'a',
  'blort'
];

/** {array<*>} Non-string values to use as test cases. */
const NON_STRING_CASES = [
  undefined,
  null,
  false,
  true,
  37,
  Symbol('florp'),
  ['like'],
  { a: 10 },
  /** Function. */ () => { /*empty*/ }
];

describe('util-core/CoreTypecheck', () => {
  describe('checkIdentifier()', () => {
    it('accepts identifier strings', () => {
      function test(value) {
        assert.strictEqual(CoreTypecheck.checkIdentifier(value), value);
      }

      test('a');
      test('A');
      test('_');
      test('blort');
      test('florp_like');
      test('x9');
      test('_0123456789_');
      test('abcdefghijklmnopqrstuvwxyz');
      test('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    });

    it('rejects non-identifier strings', () => {
      function test(value) {
        Assert.throwsInfo(
          () => { CoreTypecheck.checkIdentifier(value); },
          'bad_value',
          [inspect(value), 'String', 'identifier syntax']);
      }

      // Needs at least one character.
      test('');

      // Can't start with a digit.
      test('0a');
      test('1a');
      test('2a');
      test('3a');
      test('4a');
      test('5a');
      test('6a');
      test('7a');
      test('8a');
      test('9a');

      // Has invalid character.
      test('a-1');
      test('a/1');
      test('a!@#$%^&*');
    });

    it('rejects non-strings', () => {
      function test(value) {
        Assert.throwsInfo(
          () => { CoreTypecheck.checkIdentifier(value); },
          'bad_value',
          [inspect(value), 'String', 'identifier syntax']);
      }

      for (const v of NON_STRING_CASES) {
        test(v);
      }
    });
  });

  describe('checkLabel()', () => {
    it('accepts label strings', () => {
      function test(value) {
        assert.strictEqual(CoreTypecheck.checkLabel(value), value);
      }

      test('a');
      test('A');
      test('_');
      test('-');
      test('blort');
      test('florp_like');
      test('florp-like');
      test('x9');
      test('_0123456789_');
      test('-0123456789-');
      test('abcdefghijklmnopqrstuvwxyz');
      test('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    });

    it('rejects non-label strings', () => {
      function test(value) {
        Assert.throwsInfo(
          () => { CoreTypecheck.checkLabel(value); },
          'bad_value',
          [inspect(value), 'String', 'label syntax']);
      }

      // Needs at least one character.
      test('');

      // Can't start with a digit.
      test('0a');
      test('1a');
      test('2a');
      test('3a');
      test('4a');
      test('5a');
      test('6a');
      test('7a');
      test('8a');
      test('9a');

      // Has invalid character.
      test('a+1');
      test('a/1');
      test('a!@#$%^&*');
    });

    it('rejects non-strings', () => {
      function test(value) {
        Assert.throwsInfo(
          () => { CoreTypecheck.checkLabel(value); },
          'bad_value',
          [inspect(value), 'String', 'label syntax']);
      }

      for (const v of NON_STRING_CASES) {
        test(v);
      }
    });
  });

  describe('checkObject(value)', () => {
    it('accepts objects', () => {
      function test(value) {
        assert.strictEqual(CoreTypecheck.checkObject(value), value);
      }

      test({});
      test({ a: 10, b: 20, c: 30, });
      test([]);
      test(['blort']);
      test(new Set());
      test(() => 914);
      test(function () { return 37; });
    });

    it('rejects non-objects', () => {
      function test(value) {
        Assert.throwsInfo(
          () => { CoreTypecheck.checkObject(value); },
          'bad_value',
          [inspect(value), 'Object']);
      }

      test(null);
      test(undefined);
      test(false);
      test(123);
      test('blort');
    });
  });

  describe('checkObject(value, clazz)', () => {
    it('accepts objects of the given class', () => {
      function test(value, clazz) {
        assert.strictEqual(CoreTypecheck.checkObject(value, clazz), value);
      }

      test({},                       Object);
      test({ a: 10, b: 20, c: 30, }, Object);
      test([1, 2, 3],                Object);
      test(new Set(),                Object);
      test(new Boolean(false),       Object);
      test(() => 914,                Object);

      test([],        Array);
      test(['blort'], Array);

      test(new Boolean(false), Boolean);
      test(new Number(123),    Number);
      test(new Set(),          Set);

      test(() => 914,                  Function);
      test(function () { return 37; }, Function);
    });

    it('rejects objects of the wrong class', () => {
      function test(value, clazz) {
        Assert.throwsInfo(
          () => { CoreTypecheck.checkObject(value, clazz); },
          'bad_value',
          [inspect(value), `class ${clazz.name}`]);
      }

      test({},        Boolean);
      test([],        Number);
      test(new Set(), Array);
    });

    it('rejects non-objects', () => {
      function test(value, clazz) {
        Assert.throwsInfo(
          () => { CoreTypecheck.checkObject(value, clazz); },
          'bad_value',
          [inspect(value), `class ${clazz.name}`]);
      }

      test(null,      Object);
      test(undefined, Number);
      test(false,     Boolean);
      test(123,       Number);
      test('blort',   Set);
    });
  });

  describe('checkString(value)', () => {
    it('accepts strings', () => {
      function test(value) {
        assert.strictEqual(CoreTypecheck.checkString(value), value);
      }

      for (const v of STRING_CASES) {
        test(v);
      }
    });

    it('rejects non-strings', () => {
      function test(value) {
        Assert.throwsInfo(
          () => { CoreTypecheck.checkString(value); },
          'bad_value',
          [inspect(value), 'String']);
      }

      for (const v of NON_STRING_CASES) {
        test(v);
      }
    });
  });

  describe('checkString(value, regex)', () => {
    it('accepts strings that match the regex', () => {
      function test(value, regex) {
        assert.strictEqual(CoreTypecheck.checkString(value, regex), value);
      }

      test('blort', /o/);
      test('florp', /^f/);
    });

    it('rejects strings that do not match the regex', () => {
      function test(value, regex) {
        Assert.throwsInfo(
          () => { CoreTypecheck.checkString(value, regex); },
          'bad_value',
          [inspect(value), 'String', regex.toString()]);
      }

      test('blort', /X/);
      test('florp', /like/);
    });

    it('rejects non-strings', () => {
      function test(value) {
        Assert.throwsInfo(
          () => { CoreTypecheck.checkString(value, /./); },
          'bad_value',
          [inspect(value), 'String', '/./']);
      }

      for (const v of NON_STRING_CASES) {
        test(v);
      }
    });

    it('rejects a non-`RegExp` second argument', () => {
      const notRegex = 'not-a-regex';

      Assert.throwsInfo(
        () => { CoreTypecheck.checkString('x', notRegex); },
        'bad_value',
        [inspect(notRegex), 'RegExp']);
    });
  });

  describe('checkStringOrNull()', () => {
    it('accepts strings', () => {
      function test(value) {
        assert.strictEqual(CoreTypecheck.checkStringOrNull(value), value);
      }

      for (const v of STRING_CASES) {
        test(v);
      }
    });

    it('accepts `null`', () => {
      assert.isNull(CoreTypecheck.checkStringOrNull(null));
    });

    it('rejects non-strings that are not `null`', () => {
      function test(value) {
        if (value === null) {
          return;
        }

        assert.throws(() => { CoreTypecheck.checkString(value); });
      }

      for (const v of NON_STRING_CASES) {
        test(v);
      }
    });
  });
});
