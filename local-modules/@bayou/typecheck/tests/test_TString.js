// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { TString } from '@bayou/typecheck';

import { Assert } from '@bayou/util-core/tests/Assert';

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

describe('@bayou/typecheck/TString', () => {
  describe('check(value)', () => {
    it('accepts strings', () => {
      const value = 'this better work!';

      assert.strictEqual(TString.check(value), value);
    });

    it('rejects anything other than a string', () => {
      assert.throws(() => TString.check(54));
      assert.throws(() => TString.check(true));
      assert.throws(() => TString.check([]));
      assert.throws(() => TString.check({ }));
      assert.throws(() => TString.check(() => true));
      assert.throws(() => TString.check(undefined));
    });
  });

  describe('check(value, regex)', () => {
    it('accepts a string which matches the given regex', () => {
      const value = 'deadbeef7584930215cafe';

      assert.doesNotThrow(() => TString.check(value, /^([a-f0-9]{2})+$/));
    });

    it('rejects a non-matching string', () => {
      const value = 'this better not work!';

      assert.throws(() => TString.check(value, /^([a-f0-9]{2})+$/));
    });
  });

  describe('hexBytes(value)', () => {
    it('accepts a string of hex bytes', () => {
      const value = 'deadbeef7584930215cafe';

      assert.strictEqual(TString.hexBytes(value), value);
    });

    it('rejects a string of non-hex', () => {
      const value = 'this better not work!';

      assert.throws(() => TString.hexBytes(value));
    });
  });

  describe('hexBytes(value, minBytes)', () => {
    it('accepts a string of hex bytes of the required minimum length', () => {
      const value = 'deadbeef7584930215cafe';

      assert.strictEqual(TString.hexBytes(value, 11), value);
    });

    it('accepts a string of hex bytes greater than the required minimum length', () => {
      const value = 'deadbeef7584930215cafe';

      assert.strictEqual(TString.hexBytes(value, 3), value);
    });

    it('rejects too-short strings', () => {
      const value = 'deadbeef7584930215cafe';

      assert.throws(() => TString.hexBytes(value, 128));
    });
  });

  describe('hexBytes(value, minBytes, maxBytes)', () => {
    it('accepts a string of hex bytes of the required minimum length', () => {
      const value = 'deadbeef7584930215cafe';

      assert.strictEqual(TString.hexBytes(value, 11, 128), value);
    });

    it('accepts a string of hex bytes within the required length range', () => {
      const value = 'deadbeef7584930215cafe';

      assert.strictEqual(TString.hexBytes(value, 3, 128), value);
    });

    it('accepts a string of hex bytes equal to the maximum length', () => {
      const value = 'deadbeef7584930215cafe';

      assert.strictEqual(TString.hexBytes(value, 3, 11), value);
    });

    it('rejects too-short strings', () => {
      const value = 'deadbeef7584930215cafe';

      assert.throws(() => TString.hexBytes(value, 32, 64));
    });

    it('rejects too-long strings', () => {
      const value = 'deadbeef7584930215cafe';

      assert.throws(() => TString.hexBytes(value, 4, 8));
    });
  });

  describe('identifier()', () => {
    it('accepts identifier strings', () => {
      function test(value) {
        assert.strictEqual(TString.identifier(value), value);
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
          () => { TString.identifier(value); },
          'badValue',
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
          () => { TString.identifier(value); },
          'badValue',
          [inspect(value), 'String', 'identifier syntax']);
      }

      for (const v of NON_STRING_CASES) {
        test(v);
      }
    });
  });

  describe('label()', () => {
    it('accepts label strings', () => {
      function test(value) {
        assert.strictEqual(TString.label(value), value);
      }

      test('a');
      test('A');
      test('_');
      test('-');
      test('.');
      test('blort');
      test('florp_like');
      test('florp-like');
      test('florp.like');
      test('x9');
      test('_0123456789_');
      test('-0123456789-');
      test('.0123456789.');
      test('abcdefghijklmnopqrstuvwxyz');
      test('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    });

    it('rejects non-label strings', () => {
      function test(value) {
        Assert.throwsInfo(
          () => { TString.label(value); },
          'badValue',
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
          () => { TString.label(value); },
          'badValue',
          [inspect(value), 'String', 'label syntax']);
      }

      for (const v of NON_STRING_CASES) {
        test(v);
      }
    });
  });

  describe('maxLen()', () => {
    it('accepts short-enough strings', () => {
      function test(value, len) {
        assert.strictEqual(TString.maxLen(value, len), value);
      }

      test('', 0);
      test('', 1);
      test('', 10);
      test('a', 1);
      test('a', 2);
      test('a', 100);
      test('fooblort', 8);
      test('fooblort', 80);
    });

    it('rejects too-long strings', () => {
      function test(value, len) {
        Assert.throwsInfo(
          () => { TString.maxLen(value, len); },
          'badValue',
          [inspect(value), 'String', `value.length <= ${len}`]);
      }

      test('a',   0);
      test('ab',  0);
      test('ab',  1);
      test('abc', 0);
      test('abc', 1);
      test('abc', 2);
    });

    it('rejects non-strings', () => {
      function test(value) {
        Assert.throwsInfo(
          () => { TString.maxLen(value, 123); },
          'badValue',
          [inspect(value), 'String', 'value.length <= 123']);
      }

      for (const v of NON_STRING_CASES) {
        test(v);
      }
    });
  });

  describe('minLen()', () => {
    it('accepts long-enough strings', () => {
      function test(value, len) {
        assert.strictEqual(TString.minLen(value, len), value);
      }

      test('', 0);
      test('a', 0);
      test('a', 1);
      test('ab', 0);
      test('ab', 1);
      test('ab', 2);
      test('fooblort', 7);
      test('fooblort', 8);
    });

    it('rejects too-short strings', () => {
      function test(value, len) {
        Assert.throwsInfo(
          () => { TString.minLen(value, len); },
          'badValue',
          [inspect(value), 'String', `value.length >= ${len}`]);
      }

      test('',    1);
      test('',    10);
      test('a',   2);
      test('a',   3);
      test('ab',  3);
      test('ab',  4);
      test('abc', 4);
      test('abc', 5);
      test('abc', 123);
    });

    it('rejects non-strings', () => {
      function test(value) {
        Assert.throwsInfo(
          () => { TString.minLen(value, 1); },
          'badValue',
          [inspect(value), 'String', 'value.length >= 1']);
      }

      for (const v of NON_STRING_CASES) {
        test(v);
      }
    });
  });

  describe('nonEmpty()', () => {
    it('accepts strings of length `1` or longer', () => {
      function test(value) {
        assert.strictEqual(TString.nonEmpty(value), value);
      }

      test('x');
      test('xy');
      test('This better work!');
    });

    it('throws if value is a string of length 0', () => {
      assert.throws(() => TString.nonEmpty(''));
    });
  });

  describe('orNull()', () => {
    it('accepts strings', () => {
      const value = 'This better work!';

      assert.strictEqual(TString.orNull(value), value);
    });

    it('accepts `null`', () => {
      assert.strictEqual(TString.orNull(null), null);
    });

    it('rejects non-`null` non-strings', () => {
      assert.throws(() => TString.orNull(undefined));
      assert.throws(() => TString.orNull(5.1));
      assert.throws(() => TString.orNull([]));
      assert.throws(() => TString.orNull({ }));
      assert.throws(() => TString.orNull(NaN));
    });
  });

  describe('urlAbsolute()', () => {
    it('accepts absolute URLs', () => {
      function test(value) {
        assert.strictEqual(TString.urlAbsolute(value), value, value);
      }

      test('https://www.example.com/');
      test('http://foo.com/');
      test('https://bar.baz.co/florp');
      test('https://bar.baz.co/florp/');
      test('https://bar.baz.co/biff/boo');
    });

    it('rejects non-absolute URLs', () => {
      function test(value) {
        assert.throws(() => TString.urlAbsolute(value), /badValue/, inspect(value));
      }

      test('/home/users/fnord');
      test('http:example.com');
      test('http:example.com/foo');
      test('http:/example.com');
      test('http://example.com'); // Needs final slash.
    });

    it('rejects non-URLs', () => {
      function test(value) {
        assert.throws(() => TString.urlAbsolute(value), /badValue/, inspect(value));
      }

      test('');
      test('this better not work!');
      test(5.1);
      test(undefined);
      test(null);
    });

    it('rejects URLs with auth info', () => {
      function test(value) {
        assert.throws(() => TString.urlAbsolute(value), /badValue/, inspect(value));
      }

      test('http://user@example.com/');
      test('http://user:pass@example.com/');
    });

    it('rejects URLs with a query', () => {
      function test(value) {
        assert.throws(() => TString.urlAbsolute(value), /badValue/, inspect(value));
      }

      test('https://milk.com/?a=10');
      test('https://milk.com/?x=1&y=2');
      test('http://milk.com/bcd?e=10');
      test('http://milk.com/bcd/efgh?i=123&jkl=234');
    });

    it('rejects URLs with a hash', () => {
      function test(value) {
        assert.throws(() => TString.urlAbsolute(value), /badValue/, inspect(value));
      }

      test('https://milk.com/#florp');
      test('http://milk.com/bcd#florp');
      test('http://milk.com/bcd/efgh#florp');
    });
  });

  describe('urlOrigin()', () => {
    it('accepts origin-only URLs', () => {
      let which = 0;
      function test(value) {
        which++;
        assert.strictEqual(TString.urlOrigin(value), value, `#${which}`);
      }

      test('https://www.example.com');
      test('http://example.com');
      test('http://florp.co.uk:123');
    });

    it('rejects URLs that are not origin-only', () => {
      function test(value) {
        assert.throws(() => TString.urlOrigin(value), /badValue/, inspect(value));
      }

      test('http://foo.bar/'); // Shouldn't end with a slash.
      test('http://foo.bar/x');
      test('https://foo@bar.com');
      test('https://florp:like@example.com');
      test('http://foo.bar/?a=10');
      test('http://foo.bar/x?a=10');
      test('http://foo.bar/x/?a=10');
      test('http://foo.bar/#123');
      test('http://foo.bar/baz#123');
      test('http://foo.bar/baz/#123');
    });

    it('rejects non-URLs', () => {
      function test(value) {
        assert.throws(() => TString.urlOrigin(value), /badValue/, inspect(value));
      }

      test('this better not work!');
      test('/home/users/fnord');
      test('http:example.com');
      test('http:example.com/foo');
      test('http:/example.com');
      test(5.1);
      test(undefined);
      test(null);
    });
  });
});
