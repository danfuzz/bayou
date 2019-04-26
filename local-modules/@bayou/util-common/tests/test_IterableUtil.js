// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { IterableUtil } from '@bayou/util-common';

describe('@bayou/util-common/IterableUtil', () => {
  describe('multiUseSafe()', () => {
    it('throws an error if not passed an `Iterable`', () => {
      assert.throws(() => IterableUtil.multiUseSafe(123));
      assert.throws(() => IterableUtil.multiUseSafe('blort'));
      assert.throws(() => IterableUtil.multiUseSafe({}));
      assert.throws(() => IterableUtil.multiUseSafe({
        next: () => { return { done: true }; }
      }));
    });

    it('should pass a non-`Iterator` through as-is', () => {
      let which = 0;
      function assertAsIs(iterable) {
        which++;
        assert.strictEqual(IterableUtil.multiUseSafe(iterable), iterable, `#${which}`);
      }

      assertAsIs([]);
      assertAsIs([1, 2, 3]);
      assertAsIs(new Map());
      assertAsIs(new Set([1, 2, 3]));
    });

    it('should wrap the usual built-in suspeccts', () => {
      let which = 0;
      function assertWrapped(iterable, expectedContents) {
        which++;
        const result = IterableUtil.multiUseSafe(iterable);
        assert.notStrictEqual(result, iterable, `#${which}`);

        const gotContents = [...result];
        assert.deepEqual(gotContents, expectedContents, `#${which}`);
      }

      assertWrapped(new Map().entries(), []);
      assertWrapped(new Map().keys(),    []);
      assertWrapped(new Map().values(),  []);

      assertWrapped(new Map([['a', 10]]).entries(), [['a', 10]]);
      assertWrapped(new Map([['a', 10]]).keys(),    ['a']);
      assertWrapped(new Map([['a', 10]]).values(),  [10]);

      assertWrapped(new Map([['a', 10], ['b', 20]]).entries(), [['a', 10], ['b', 20]]);
      assertWrapped(new Map([['a', 10], ['b', 20]]).keys(),    ['a', 'b']);
      assertWrapped(new Map([['a', 10], ['b', 20]]).values(),  [10, 20]);

      assertWrapped(new Set().entries(), []);
      assertWrapped(new Set().keys(),    []);
      assertWrapped(new Set().values(),  []);

      assertWrapped(new Set([1]).entries(), [[1, 1]]);
      assertWrapped(new Set([1]).keys(),    [1]);
      assertWrapped(new Set([1]).values(),  [1]);

      assertWrapped(new Set([1, 2, 3]).entries(), [[1, 1], [2, 2], [3, 3]]);
      assertWrapped(new Set([1, 2, 3]).keys(),    [1, 2, 3]);
      assertWrapped(new Set([1, 2, 3]).values(),  [1, 2, 3]);
    });

    it('should only call through to an underlying iterator once', () => {
      const iterator = new Set([1, 2, 'blort', 4, 5]).keys();
      const wrapped  = IterableUtil.multiUseSafe(iterator);
      const expected = [1, 2, 'blort', 4, 5];
      const result1  = [...wrapped];
      const result2  = [...wrapped];
      const result3  = [...wrapped];

      assert.deepEqual(result1, expected);
      assert.deepEqual(result2, expected);
      assert.deepEqual(result3, expected);
    });

    it('works in the face of interleaved iteration', () => {
      const iterator = new Set([1, 2, 3, 'florp', 5, 6.7]).keys();
      const wrapped  = IterableUtil.multiUseSafe(iterator);
      const expected = [1, 2, 3, 'florp', 5, 6.7];
      const iter1    = wrapped[Symbol.iterator]();
      const iter2    = wrapped[Symbol.iterator]();
      const result1  = [];
      const result2  = [];

      for (;;) {
        const next1 = iter1.next();
        if (next1.done) {
          break;
        } else {
          result1.push(next1.value);
        }

        const next2 = iter2.next();
        assert.notStrictEqual(next2.done, true);
        result2.push(next2.value);
      }

      const next2 = iter2.next();
      assert.strictEqual(next2.done, true);

      assert.deepEqual(result1, expected);
      assert.deepEqual(result2, expected);
    });
  });

  it('should only call through to the underlying iterator as needed', () => {
    let count = 0;

    function* rawIterator() {
      for (let i = 0; i < 10; i++) {
        count = i + 1;
        yield i;
      }
    }

    const rawIterable = {
      [Symbol.iterator]: () => { return rawIterator(); }
    };

    const wrapped  = IterableUtil.multiUseSafe(rawIterable);
    const iterator = wrapped[Symbol.iterator]();

    for (let i = 0; i < 10; i++) {
      assert.strictEqual(count, i);
      const next = iterator.next();
      assert.strictEqual(next.value, i);
    }

    assert.strictEqual(count, 10);
  });
});
