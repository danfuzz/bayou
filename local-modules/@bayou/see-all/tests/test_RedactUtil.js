// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { RedactUtil } from '@bayou/see-all';
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

describe('@bayou/see-all/RedactUtil', () => {
  describe('truncateString()', () => {
    it('rejects non-string `value` arguments', () => {
      function test(v) {
        assert.throws(() => RedactUtil.truncateString(v, 100), /badValue/);
      }

      test(undefined);
      test(null);
      test(true);
      test(123);
      test(['boop']);
    });

    it('rejects invalud `maxLength` arguments', () => {
      function test(m) {
        assert.throws(() => RedactUtil.truncateString('xyzabc', m), /badValue/);
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
          assert.strictEqual(RedactUtil.truncateString(s, i + j), s, `${i}, ${j}`);
        }
      }
    });

    it('truncates too-long strings', () => {
      for (let i = 0; i < 250; i += 25) {
        const s = makeString(i);

        for (let j = 3 + (i % 7); j < i; j += 11) {
          const expect = `${s.slice(0, j - 3)}...`;
          assert.strictEqual(RedactUtil.truncateString(s, j), expect, `${i}, ${j}`);
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
    testFullRedaction(v => RedactUtil.fullyRedact(v));
  });

  describe('redactValues()', () => {
    it('rejects bad values for `maxDepth`', () => {
      function test(m) {
        assert.throws(() => RedactUtil.redactValues('x', m), /badValue/);
      }

      test(undefined);
      test(null);
      test('florp');
      test(-1);
      test(2.4);
    });

    describe('when `maxDepth === 0`', () => {
      testFullRedaction(v => RedactUtil.redactValues(v, 0));
    });

    describe('when `maxDepth !== 0` and is valid', () => {
      describe('common cases for `maxDepth === 1`', () => {
        testCommonRedaction(v => RedactUtil.redactValues(v, 1));
      });

      describe('common cases for `maxDepth === 2`', () => {
        testCommonRedaction(v => RedactUtil.redactValues(v, 2));
      });

      it('indicates the lengths of strings', () => {
        for (let i = 0; i < 1000; i = Math.floor((i + 10) * 3 / 2)) {
          const s      = makeString(i);
          const expect = `... length ${i}`;

          for (let d = 1; d < 5; d++) {
            assert.strictEqual(RedactUtil.redactValues(s, d), expect, `${i}, ${d}`);
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
              expect.push(RedactUtil.redactValues(v, d - 1));
            }
            assert.deepEqual(RedactUtil.redactValues(arr, d), expect, `${len}, ${d}`);
          }
        }
      });

      it('indicates the count of extra elements of too-large arrays (basic case)', () => {
        const orig   = [null, null, null, null, null, null, null, null, null, null, 1, 2, 345];
        const expect = [null, null, null, null, null, null, null, null, null, null, '... 3 more'];

        assert.deepEqual(RedactUtil.redactValues(orig, 1), expect);
        assert.deepEqual(RedactUtil.redactValues(orig, 2), expect);
        assert.deepEqual(RedactUtil.redactValues(orig, 5), expect);
      });

      it('indicates the count of extra elements of too-large arrays', () => {
        const MAX        = 10;
        const orig       = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const baseExpect = RedactUtil.redactValues(orig, 1);

        for (let len = MAX + 1; len < 1000; len = Math.floor((len + 10) * 3 / 2)) {
          const expect = [...baseExpect, `... ${len - MAX} more`];

          while (orig.length < len) {
            orig.push('x');
          }

          for (let d = 1; d <= 6; d++) {
            assert.deepEqual(RedactUtil.redactValues(orig, d), expect, `${len}, ${d}`);
          }
        }
      });

      it('represents all elements of small-enough plain objects', () => {
        const orig = {
          a: { b: { c: { d: { e: { f: 'boop' } } } } },
          bb: 1,
          cc: false,
          dd: undefined,
          ee: new Map(),
          ff: [[[1, 2, 3]]],
          gg: { x: 123 },
          hh: { y: [], z: 'xyz' },
          ii: { z: new Map() },
          jj: { x: 'x', y: 'y', z: 'z' },
          x1: 123,
          x2: 456,
          x3: 789,
          x4: 'beep',
          x5: 'boop',
          x6: 'beep',
          x7: 'boop',
          x8: 'beep',
          x9: 'boop',
          bongo: Symbol('drum')
        };
        const origEntries = Object.entries(orig);

        for (let len = 0; len <= origEntries.length; len++) {
          const obj = {};
          for (let i = 0; i < len; i++) {
            const [k, v] = origEntries[i];
            obj[k] = v;
          }

          for (let d = 1; d <= 6; d++) {
            const expect = {};
            for (const [k, v] of Object.entries(obj)) {
              expect[k] = RedactUtil.redactValues(v, d - 1);
            }
            assert.deepEqual(RedactUtil.redactValues(obj, d), expect, `${len}, ${d}`);
          }
        }
      });

      it('indicates the count of extra elements of too-large objects (basic case)', () => {
        const orig = {
          x01: null,
          x02: null,
          x03: null,
          x04: null,
          x05: null,
          x06: null,
          x07: null,
          x08: null,
          x09: null,
          x10: null,
          x11: null,
          x12: null,
          x13: null,
          x14: null,
          x15: null,
          x16: null,
          x17: null,
          x18: null,
          x19: null,
          x20: null,
          z1:  1,
          z2:  2,
          z3:  3,
          z4:  456
        };

        const expect = {
          x01: null,
          x02: null,
          x03: null,
          x04: null,
          x05: null,
          x06: null,
          x07: null,
          x08: null,
          x09: null,
          x10: null,
          x11: null,
          x12: null,
          x13: null,
          x14: null,
          x15: null,
          x16: null,
          x17: null,
          x18: null,
          x19: null,
          x20: null,
          '...': '... 4 more'
        };

        assert.deepEqual(RedactUtil.redactValues(orig, 1), expect);
        assert.deepEqual(RedactUtil.redactValues(orig, 2), expect);
        assert.deepEqual(RedactUtil.redactValues(orig, 5), expect);
      });

      it('indicates the count of extra elements of too-large objects', () => {
        const MAX        = 20;
        const orig       = {};
        let   origLen    = 0;

        function makeLen(len) {
          while (origLen < len) {
            const lenStr = `000${origLen}`;
            orig[`x${lenStr.slice(lenStr.length - 3)}`] = 1;
            origLen++;
          }
        }

        makeLen(MAX);

        const baseExpect = RedactUtil.redactValues(orig, 1);

        for (let len = MAX + 1; len < 1000; len = Math.floor((len + 10) * 3 / 2)) {
          const expect = Object.assign({ '...': `... ${len - MAX} more` }, baseExpect);

          makeLen(len);

          for (let d = 1; d <= 6; d++) {
            assert.deepEqual(RedactUtil.redactValues(orig, d), expect, `${len}, ${d}`);
          }
        }
      });
    });
  });
});
