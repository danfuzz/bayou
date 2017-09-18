// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { TString } from 'typecheck';

import Assert from 'util-core/tests/Assert';

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

describe('typecheck/TString', () => {
  describe('check(value)', () => {
    it('should return the provided value when passed a string', () => {
      const value = 'this better work!';

      assert.strictEqual(TString.check(value), value);
    });

    it('should throw an Error when passed anything other than a string', () => {
      assert.throws(() => TString.check(54));
      assert.throws(() => TString.check(true));
      assert.throws(() => TString.check([]));
      assert.throws(() => TString.check({ }));
      assert.throws(() => TString.check(() => true));
      assert.throws(() => TString.check(undefined));
    });
  });

  describe('check(value, regex)', () => {
    it('should allow a string when it matches the provided regex', () => {
      const value = 'deadbeef7584930215cafe';

      assert.doesNotThrow(() => TString.check(value, /^([a-f0-9]{2})+$/));
    });

    it('should throw an Error when a string fails to match the provided regex', () => {
      const value = 'this better not work!';

      assert.throws(() => TString.check(value, /^([a-f0-9]{2})+$/));
    });
  });

  describe('hexBytes(value)', () => {
    it('should return the provided value if it is a string of hex bytes', () => {
      const value = 'deadbeef7584930215cafe';

      assert.strictEqual(TString.hexBytes(value), value);
    });

    it('should throw an Error when anything other than a string of hex bytes is provided', () => {
      const value = 'this better not work!';

      assert.throws(() => TString.hexBytes(value));
    });
  });

  describe('hexBytes(value, minBytes)', () => {
    it('should return the provided value if it is a string of hex bytes of the required minimum length', () => {
      const value = 'deadbeef7584930215cafe';

      assert.strictEqual(TString.hexBytes(value, 11), value);
    });

    it('should return the provided value if it is a string of hex bytes greater than the required minimum length', () => {
      const value = 'deadbeef7584930215cafe';

      assert.strictEqual(TString.hexBytes(value, 3), value);
    });

    it('should throw an Error if the number of bytes is less than the minimum', () => {
      const value = 'deadbeef7584930215cafe';

      assert.throws(() => TString.hexBytes(value, 128));
    });
  });

  describe('hexBytes(value, minBytes, maxBytes)', () => {
    it('should return the provided value if it is a string of hex bytes of the required minimum length', () => {
      const value = 'deadbeef7584930215cafe';

      assert.strictEqual(TString.hexBytes(value, 11, 128), value);
    });

    it('should return the provided value if it is a string of hex bytes within the required length range', () => {
      const value = 'deadbeef7584930215cafe';

      assert.strictEqual(TString.hexBytes(value, 3, 128), value);
    });

    it('should return the provided value if it is a string of hex bytes equal to the maximum length', () => {
      const value = 'deadbeef7584930215cafe';

      assert.strictEqual(TString.hexBytes(value, 3, 11), value);
    });

    it('should throw an Error if the number of bytes is less than the minimum', () => {
      const value = 'deadbeef7584930215cafe';

      assert.throws(() => TString.hexBytes(value, 32, 64));
    });

    it('should throw an Error if the number of bytes is greater than the minimum', () => {
      const value = 'deadbeef7584930215cafe';

      assert.throws(() => TString.hexBytes(value, 4, 8));
    });
  });

  describe('checkIdentifier()', () => {
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
          () => { TString.identifier(value); },
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
        assert.strictEqual(TString.label(value), value);
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
          () => { TString.label(value); },
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
          () => { TString.label(value); },
          'bad_value',
          [inspect(value), 'String', 'label syntax']);
      }

      for (const v of NON_STRING_CASES) {
        test(v);
      }
    });
  });

  describe('nonEmpty()', () => {
    it('should return the provided value if it is a string with length >= 1', () => {
      const value = 'This better work!';

      assert.strictEqual(TString.nonEmpty(value), value);
    });

    it('should throw an Error if value is a string of length 0', () => {
      const value = '';

      assert.throws(() => TString.nonEmpty(value));
    });
  });

  describe('orNull()', () => {
    it('should return the provided value if it is a string', () => {
      const value = 'This better work!';

      assert.strictEqual(TString.orNull(value), value);
    });

    it('should return the provided value if it is null', () => {
      const value = null;

      assert.strictEqual(TString.orNull(value), value);
    });

    it('should throw an Error if value is not a string and is not null', () => {
      assert.throws(() => TString.orNull(undefined));
      assert.throws(() => TString.orNull(5.1));
      assert.throws(() => TString.orNull([]));
      assert.throws(() => TString.orNull({ }));
      assert.throws(() => TString.orNull(NaN));
    });
  });

  describe('urlAbsolute()', () => {
    it('should return the provided value if it is an absolute URL string', () => {
      const value = 'https://www.example.com/';

      assert.strictEqual(TString.urlAbsolute(value), value);
    });

    it('should throw an Error if value is not a URL string at all', () => {
      assert.throws(() => TString.urlAbsolute('this better not work!'));
      assert.throws(() => TString.urlAbsolute('/home/users/fnord'));
      assert.throws(() => TString.urlAbsolute('http:example.com'));
      assert.throws(() => TString.urlAbsolute('http:example.com/foo'));
      assert.throws(() => TString.urlAbsolute('http:/example.com'));
      assert.throws(() => TString.urlAbsolute('http://example.com')); // Needs final slash.
      assert.throws(() => TString.urlAbsolute(5.1));
      assert.throws(() => TString.urlAbsolute(undefined));
      assert.throws(() => TString.urlAbsolute(null));
    });

    it('should throw an Error if value has auth info', () => {
      assert.throws(() => TString.urlAbsolute('http://user@example.com/'));
      assert.throws(() => TString.urlAbsolute('http://user:pass@example.com/'));
    });
  });

  describe('urlOrigin()', () => {
    it('should return the provided value if it is an origin-only URL', () => {
      let which = 0;
      function test(value) {
        which++;
        assert.strictEqual(TString.urlOrigin(value), value, `#${which}`);
      }

      test('https://www.example.com');
      test('http://example.com');
      test('http://florp.co.uk:123');
    });

    it('should throw an Error if value is not an origin-only URL', () => {
      assert.throws(() => TString.urlOrigin('http://foo.bar/'));
      assert.throws(() => TString.urlOrigin('http://foo.bar/x'));
      assert.throws(() => TString.urlOrigin('https://foo@bar.com'));
      assert.throws(() => TString.urlOrigin('https://florp:like@example.com'));
    });

    it('should throw an Error if value is not a URL string at all', () => {
      assert.throws(() => TString.urlOrigin('this better not work!'));
      assert.throws(() => TString.urlOrigin('/home/users/fnord'));
      assert.throws(() => TString.urlOrigin('http:example.com'));
      assert.throws(() => TString.urlOrigin('http:example.com/foo'));
      assert.throws(() => TString.urlOrigin('http:/example.com'));
      assert.throws(() => TString.urlOrigin(5.1));
      assert.throws(() => TString.urlOrigin(undefined));
      assert.throws(() => TString.urlOrigin(null));
    });
  });
});
