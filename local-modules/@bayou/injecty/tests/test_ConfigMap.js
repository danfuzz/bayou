// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

// This class isn't exported publicly, so it needs to be imported by path.
import { ConfigMap } from '@bayou/injecty/ConfigMap';

describe('@bayou/injecty/ConfigMap', () => {
  describe('constructor', () => {
    it('constructs an instance without error', () => {
      new ConfigMap();
    });
  });

  describe('add()', () => {
    it('throws an error when called twice with the same name', () => {
      const cm = new ConfigMap();

      cm.add('whee', 1);
      assert.throws(() => { cm.add('whee', 1); }, /badUse/);
    });
  });

  describe('get()', () => {
    it('retrieves a previously-added value', () => {
      const cm = new ConfigMap();
      const v  = ['yay'];

      cm.add('whee', v);
      assert.strictEqual(cm.get('whee'), v);
    });

    it('throws an error when given an un-added name', () => {
      const cm = new ConfigMap();
      assert.throws(() => { cm.get('florp'); }, /badUse/);
    });
  });
});
