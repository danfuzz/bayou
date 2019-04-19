// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { RedactUtils } from '@bayou/see-all';
import { Functor } from '@bayou/util-common';

/**
 * Makes a string of a specified length.
 *
 * @param {Int} len String length.
 * @returns {string} An appropriately-constructed string.
 */
function makeString(len) {
  let s = 'florp-';

  while (s.length < len) {
    s = `${s}-${s.length}-bloop`;
  }

  return s.slice(0, len);
}

describe('@bayou/see-all/RedactUtils', () => {
  describe('truncateString()', () => {
    it('rejects non-string `value` arguments', () => {
      function test(v) {
        assert.throws(() => RedactUtils.truncateString(v, 100), /badValue/);
      }

      test(undefined);
      test(null);
      test(true);
      test(123);
      test(['boop']);
    });

    it('rejects invalud `maxLength` arguments', () => {
      function test(m) {
        assert.throws(() => RedactUtils.truncateString('xyzabc', m), /badValue/);
      }

      test(undefined);
      test(null);
      test(true);
      test('florp');

      // Too small or not an integer.
      test(-1);
      test(0);
      test(1);
      test(2);
      test(3.1);
    });

    it('passes sufficiently-short strings through unchanged', () => {
      for (let i = 0; i < 250; i += 25) {
        const s = makeString(i);

        for (let j = 0; j <= 10; j++) {
          if ((i + j) < 3) continue;
          assert.strictEqual(RedactUtils.truncateString(s, i + j), s, `${i}, ${j}`);
        }
      }
    });

    it('truncates too-long strings', () => {
      for (let i = 0; i < 250; i += 25) {
        const s = makeString(i);

        for (let j = 3 + (i % 7); j < i; j += 11) {
          const expect = `${s.slice(0, j - 3)}...`;
          assert.strictEqual(RedactUtils.truncateString(s, j), expect, `${i}, ${j}`);
        }
      }
    });
  });

  // Common tests for `fullyRedact()` and `redactValues()`, specifically for the
  // behavior of the latter which is _not_ depth-dependent.
  function testCommonRedaction(redact) {
    it('passes `undefined` through as-is', () => {
      assert.strictEqual(redact(undefined), undefined);
    });

    it('passes `null` through as-is', () => {
      assert.strictEqual(redact(null), null);
    });

    it('converts instances to `new_name(\'...\')`', () => {
      function test(name, obj) {
        const expect = new Functor(`new_${name}`, '...');
        assert.deepEqual(redact(obj), expect);
      }

      class Beep {}
      test(Beep.name, new Beep());

      class Boop {}
      test(Boop.name, new Boop());

      test(Map.name, new Map());
      test(RegExp.name, /florp/);
    });

    it('converts other atomic primitive types to `type(\'...\')`', () => {
      function test(v) {
        const expect = new Functor(`${typeof v}`, '...');
        assert.deepEqual(redact(v), expect);
      }

      test(false);
      test(true);
      test(123);
      test(123.456);
      test(Symbol('x'));
    });
  }

  // Tests for `fullyRedact()` which are also used to test `redactValues()` when
  // `maxDepth === 0`.
  function testFullRedaction(redact) {
    testCommonRedaction(redact);

    it('converts all strings to `...`', () => {
      const expect = '...';

      assert.strictEqual(redact(''), expect);
      assert.strictEqual(redact('a'), expect);
      assert.strictEqual(redact('bc'), expect);
      assert.strictEqual(redact('def'), expect);
      assert.strictEqual(redact('ghij'), expect);
      assert.strictEqual(redact('floop-de-doop'), expect);
    });

    it('converts all arrays to `[\'...\']`', () => {
      const expect = ['...'];

      assert.deepEqual(redact([]), expect);
      assert.deepEqual(redact([1]), expect);
      assert.deepEqual(redact(['a', 'b']), expect);
      assert.deepEqual(redact([null, null, undefined]), expect);
    });

    it('converts all plain objects to `{ \'...\': \'...\' }`', () => {
      const expect = { '...': '...' };

      assert.deepEqual(redact({}), expect);
      assert.deepEqual(redact({ a: 1 }), expect);
      assert.deepEqual(redact({ foo: 'bar', florp: 'like' }), expect);
    });
  }

  describe('fullyRedact()', () => {
    testFullRedaction(v => RedactUtils.fullyRedact(v));
  });

  describe('redactValues()', () => {
    it('rejects bad values for `maxDepth`', () => {
      function test(m) {
        assert.throws(() => RedactUtils.redactValues('x', m), /badValue/);
      }

      test(undefined);
      test(null);
      test('florp');
      test(-1);
      test(2.4);
    });

    describe('when `maxDepth === 0`', () => {
      testFullRedaction(v => RedactUtils.redactValues(v, 0));
    });

    describe('when `maxDepth !== 0` and is valid', () => {
      describe('common cases for `maxDepth === 1`', () => {
        testCommonRedaction(v => RedactUtils.redactValues(v, 1));
      });

      describe('common cases for `maxDepth === 2`', () => {
        testCommonRedaction(v => RedactUtils.redactValues(v, 2));
      });

      it('indicates the lengths of strings', () => {
        for (let i = 0; i < 1000; i = Math.floor((i + 10) * 3 / 2)) {
          const s      = makeString(i);
          const expect = `... length ${i}`;

          for (let d = 1; d < 5; d++) {
            assert.strictEqual(RedactUtils.redactValues(s, d), expect, `${i}, ${d}`);
          }
        }
      });

      it('represents all elements of small-enough arrays', () => {
        const orig = [[[[[['boop']]]]], 'a', true, null, undefined, 123, /x/, [], [1], { a: 'florp' }];

        for (let len = 0; len <= orig.length; len++) {
          const arr = orig.slice(0, len);
          for (let d = 1; d <= 6; d++) {
            const expect = [];
            for (const v of arr) {
              expect.push(RedactUtils.redactValues(v, d - 1));
            }
            assert.deepEqual(RedactUtils.redactValues(arr, d), expect, `${len}, ${d}`);
          }
        }
      });

      it('indicates the count of extra elements of too-large arrays', () => {
        const MAX        = 10;
        const orig       = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const baseExpect = RedactUtils.redactValues(orig, 1);

        for (let len = 11; len < 1000; len = Math.floor((len + 10) * 3 / 2)) {
          const expect = [...baseExpect, `... ${len - MAX} more`];

          while (orig.length < len) {
            orig.push('x');
          }

          for (let d = 1; d <= 6; d++) {
            assert.deepEqual(RedactUtils.redactValues(orig, d), expect, `${len}, ${d}`);
          }
        }
      });

      // **TODO:** Test plain objects.
    });
  });
});
