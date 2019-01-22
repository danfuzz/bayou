// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { BearerToken } from '@bayou/api-common';
import { ProxiedObject } from '@bayou/api-server';

/** {array<object>} Valid values for `target`. */
const VALID_TARGETS = [
  new Map(),
  new BearerToken('foo', 'bar'), // Picked as an arbitrary non-system class.
  { florp() { return 'like'; } }
];

/** {array<object>} Invalid values for `target`. */
const INVALID_TARGETS = [
  null,
  undefined,
  true,
  123,
  'florp'
];

describe('@bayou/api-server/ProxiedObject', () => {
  describe('constructor()', () => {
    it('should accept arbitrary objects', () => {
      for (const t of VALID_TARGETS) {
        assert.doesNotThrow(() => new ProxiedObject(t), inspect(t));
      }
    });

    it('should reject non-objects', () => {
      for (const t of INVALID_TARGETS) {
        assert.throws(() => new ProxiedObject(t), /badValue/, inspect(t));
      }
    });
  });

  describe('.target', () => {
    it('should be the same as the `target` passed to the constructor', () => {
      for (const t of VALID_TARGETS) {
        const str = inspect(t);
        const po  = new ProxiedObject(t);
        assert.strictEqual(po.target, t, str);
      }
    });
  });

  describe('deconstruct()', () => {
    it('should be a single-element array with the same contents as the `target` passed to the constructor', () => {
      for (const t of VALID_TARGETS) {
        const str = inspect(t);
        const po  = new ProxiedObject(t);
        const dec = po.deconstruct();
        assert.isArray(dec);
        assert.lengthOf(dec, 1);
        assert.strictEqual(dec[0], t, str);
      }
    });
  });
});
