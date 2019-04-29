// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BaseAuth } from '@bayou/config-server';

describe('@bayou/config-server/BaseAuth', () => {
  describe('.TYPE_*', () => {
    const items = ['author', 'none', 'root'];

    for (const item of items) {
      const name = `TYPE_${item}`;
      describe(`.${name}`, () => {
        it('is a string', () => {
          assert.isString(BaseAuth[name]);
        });
      });
    }

    it('has unique values for all items', () => {
      const set = new Set();
      for (const item of items) {
        const name = `TYPE_${item}`;
        set.add(BaseAuth[name]);
      }

      assert.strictEqual(set.size, items.length);
    });
  });
});
