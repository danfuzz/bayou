// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { CaretId } from '@bayou/doc-common';

/** {array<string>} Example valid ID strings. */
const VALID_IDS = [
  'cr-12345',
  'cr-67890',
  'cr-abcde',
  'cr-fghij',
  'cr-klmno',
  'cr-pqrst',
  'cr-uvwxy',
  'cr-z0123'
];

/** {array<string>} Example invalid ID strings. */
const INVALID_STRINGS = [
  '',
  'c',
  'cr',
  'cr-',
  'cr-1',
  'cr-12',
  'cr-123',
  'cr-1234',
  'cr-123456',
  'cr-1234567',
  'cr-12345678',
  'cr-123456789',
  'cr-1234567890',
  'cr-1234567890x',
  'cr-1234567890xy',
  'cr-ABCDE',
  'cr-FGHIJ',
  'cr-abc#d',
  'cr-ab-cd',
  'xy-12345',
  'cr+12345'
];

/** {array<*>} Example non-strings. */
const NON_STRINGS = [
  undefined,
  null,
  false,
  true,
  123,
  ['x'],
  { a: 914 }
];

describe('@bayou/doc-common/CaretId', () => {
  describe('check()', () => {
    it('should accept valid ID strings', () => {
      for (const s of VALID_IDS) {
        assert.strictEqual(CaretId.check(s), s, s);
      }
    });

    it('rejects invalid ID strings', () => {
      for (const s of INVALID_STRINGS) {
        assert.throws(() => CaretId.check(s), /badValue/, s);
      }
    });

    it('rejects non-strings', () => {
      for (const v of NON_STRINGS) {
        assert.throws(() => CaretId.check(v), /badValue/, v);
      }
    });
  });

  describe('isInstance()', () => {
    it('returns `true` for valid ID strings', () => {
      for (const s of VALID_IDS) {
        assert.isTrue(CaretId.isInstance(s), s);
      }
    });

    it('returns `false` for invalid ID strings', () => {
      for (const s of INVALID_STRINGS) {
        assert.isFalse(CaretId.isInstance(s), s);
      }
    });

    it('returns `false` for non-strings', () => {
      for (const v of NON_STRINGS) {
        assert.isFalse(CaretId.isInstance(v), v);
      }
    });
  });

  describe('payloadFromId()', () => {
    it('returns the payload from a valid id', () => {
      assert.strictEqual('fooba', CaretId.payloadFromId('cr-fooba'));
      assert.strictEqual('0zor0', CaretId.payloadFromId('cr-0zor0'));
    });

    it('rejects invalid ID strings', () => {
      for (const s of INVALID_STRINGS) {
        assert.throws(() => CaretId.payloadFromId(s), /badValue/, s);
      }
    });

    it('rejects non-strings', () => {
      for (const v of NON_STRINGS) {
        assert.throws(() => CaretId.payloadFromId(v), /badValue/, v);
      }
    });
  });

  describe('randomInstance()', () => {
    it('returns values for which `isInstance()` is `true`', () => {
      for (let i = 0; i < 10; i++) {
        const id = CaretId.randomInstance();
        assert.isTrue(CaretId.isInstance(id), id);
      }
    });

    it('returns a different value every time (practically speaking)', () => {
      // This is well under the count at which we can statistically expect a
      // collision to always occur -- at about 6800, the chance of a collision
      // is about 50% -- but collisions might still legitimately crop up in this
      // test (they have in practice), we accept up to two.
      const COUNT = 1000;

      const all = new Set();

      for (let i = 0; i < COUNT; i++) {
        all.add(CaretId.randomInstance());
      }

      assert.isAtLeast(all.size, COUNT - 2);
    });
  });
});
