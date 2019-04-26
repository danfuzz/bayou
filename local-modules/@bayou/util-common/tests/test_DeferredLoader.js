// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { DeferredLoader } from '@bayou/util-common';

describe('@bayou/util-common/DeferredLoader', () => {
  describe('makeProxy()', () => {
    it('accepts valid arguments', () => {
      assert.doesNotThrow(() => { DeferredLoader.makeProxy('hello', () => true); });
    });

    it('rejects invalid label arguments', () => {
      assert.throws(() => { DeferredLoader.makeProxy('', () => true); });
      assert.throws(() => { DeferredLoader.makeProxy(37, () => true); });
    });

    it('rejects invalid loader arguments', () => {
      assert.throws(() => { DeferredLoader.makeProxy('hello', null); });
      assert.throws(() => { DeferredLoader.makeProxy('hello', 'blort'); });
      assert.throws(() => { DeferredLoader.makeProxy('hello', new Map()); });
    });
  });

  describe('makeProxy() result access', () => {
    it('should succeed in getting properties from the loaded value', () => {
      const loaded = { a: ['blort'], b: ['florp'] };
      function loader() { return loaded; }

      const dl = DeferredLoader.makeProxy('x', loader);
      assert.strictEqual(dl.a, loaded.a);
      assert.strictEqual(dl.b, loaded.b);
    });

    it('should only ever call the loader once', () => {
      const loaded = { a: 10 };
      let   count  = 0;
      function loader() { count++; return loaded; }

      const dl = DeferredLoader.makeProxy('x', loader);
      assert.strictEqual(dl.a, loaded.a);
      dl.a;
      dl.a;
      dl.a;
      dl.a;
      dl.a;
      assert.strictEqual(count, 1);
    });

    it('throws an error when trying to get properties not in the loaded value', () => {
      const loaded = { yep: 'yep' };
      function loader() { return loaded; }

      const dl = DeferredLoader.makeProxy('x', loader);
      assert.throws(() => { dl.nopeNotBound; });
    });

    it('throws an error if the loader throws an error', () => {
      function loader() { throw new Error('oy'); }

      const dl = DeferredLoader.makeProxy('x', loader);
      assert.throws(() => { dl.anything; });
    });

    it('throws an error if the loader does not return an object', () => {
      function loader() { return 914; }

      const dl = DeferredLoader.makeProxy('x', loader);
      assert.throws(() => { dl.anything; });
    });

    it('should only call the loader once even if it throws an error', () => {
      let count = 0;
      function loader() { count++; throw new Error('oy'); }

      const dl = DeferredLoader.makeProxy('x', loader);
      assert.throws(() => { dl.anything; });
      assert.throws(() => { dl.anything; });
      assert.strictEqual(count, 1);
    });
  });
});
