// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { Remote } from '@bayou/api-common';

/** {array<object>} Valid values for `targetId`. */
const VALID_IDS = [
  'a',
  '1',
  'abc',
  'florp-like',
  'foo.bar',
  'something_else'
];

/** {array<object>} Invalid values for `targetId`. */
const INVALID_IDS = [
  null,
  undefined,
  true,
  123,
  [],
  ['x'],
  { a: 'b' },
  new Map(),
  '',
  '#',
  'foo!'
];

describe('@bayou/api-common/Remote', () => {
  describe('constructor()', () => {
    it('accepts valid IDs', () => {
      for (const id of VALID_IDS) {
        assert.doesNotThrow(() => new Remote(id), id);
      }
    });

    it('rejects invalid values for `targetId`', () => {
      for (const id of INVALID_IDS) {
        assert.throws(() => new Remote(id), /badValue/, inspect(id));
      }
    });
  });

  describe('.targetId', () => {
    it('should be the same as the `targetID` passed to the constructor', () => {
      for (const id of VALID_IDS) {
        const r = new Remote(id);
        assert.strictEqual(r.targetId, id);
      }
    });
  });

  describe('deconstruct()', () => {
    it('should be a single-element array with the same contents as the `targetId` passed to the constructor', () => {
      for (const id of VALID_IDS) {
        const r   = new Remote(id);
        const dec = r.deconstruct();
        assert.isArray(dec);
        assert.lengthOf(dec, 1);
        assert.strictEqual(dec[0], id, id);
      }
    });
  });
});
