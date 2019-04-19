// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { RedactUtils } from '@bayou/see-all';
import { Functor } from '@bayou/util-common';

describe('@bayou/see-all/RedactUtils', () => {
  describe('truncateString()', () => {
    function makeString(len) {
      let s = 'florp-';

      while (s.length < len) {
        s = `${s}-${s.length}-bloop`;
      }

      return s.slice(0, len);
    }

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

  describe('fullyRedact()', () => {
    it('passes `undefined` through as-is', () => {
      assert.strictEqual(RedactUtils.fullyRedact(undefined), undefined);
    });

    it('passes `null` through as-is', () => {
      assert.strictEqual(RedactUtils.fullyRedact(null), null);
    });

    it('converts all strings to `...`', () => {
      const expect = '...';

      assert.strictEqual(RedactUtils.fullyRedact(''), expect);
      assert.strictEqual(RedactUtils.fullyRedact('a'), expect);
      assert.strictEqual(RedactUtils.fullyRedact('bc'), expect);
      assert.strictEqual(RedactUtils.fullyRedact('def'), expect);
      assert.strictEqual(RedactUtils.fullyRedact('ghij'), expect);
      assert.strictEqual(RedactUtils.fullyRedact('floop-de-doop'), expect);
    });

    it('converts all arrays to `[\'...\']`', () => {
      const expect = ['...'];

      assert.deepEqual(RedactUtils.fullyRedact([]), expect);
      assert.deepEqual(RedactUtils.fullyRedact([1]), expect);
      assert.deepEqual(RedactUtils.fullyRedact(['a', 'b']), expect);
      assert.deepEqual(RedactUtils.fullyRedact([null, null, undefined]), expect);
    });

    it('converts instances to `new_name(\'...\')`', () => {
      function test(name, obj) {
        const expect = new Functor(`new_${name}`, '...');
        assert.deepEqual(RedactUtils.fullyRedact(obj), expect);
      }

      class Beep {}
      test(Beep.name, new Beep());

      class Boop {}
      test(Boop.name, new Boop());

      test(Map.name, new Map());
      test(RegExp.name, /florp/);
    });

    it('converts all plain objects to `{ \'...\': \'...\' }`', () => {
      const expect = { '...': '...' };

      assert.deepEqual(RedactUtils.fullyRedact({}), expect);
      assert.deepEqual(RedactUtils.fullyRedact({ a: 1 }), expect);
      assert.deepEqual(RedactUtils.fullyRedact({ foo: 'bar', florp: 'like' }), expect);
    });

    it('converts other primitive types to `type(\'...\')`', () => {
      function test(v) {
        const expect = new Functor(`${typeof v}`, '...');
        assert.deepEqual(RedactUtils.fullyRedact(v), expect);
      }

      test(false);
      test(true);
      test(123);
      test(123.456);
      test(Symbol('x'));
    });
  });
});
