// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { BearerToken } from '@bayou/api-common';
import { Schema, Target } from '@bayou/api-server';
import { Functor } from '@bayou/util-common';

/** {array<object>} Valid values for `directObject`. */
const VALID_DIRECTS = [
  new Map(),
  new BearerToken('foo', 'bar'), // Picked as an arbitrary non-system class.
  { florp() { return 'like'; } },
  {}
];

/** {array<object>} Invalid values for `directObject`. */
const INVALID_DIRECTS = [
  null,
  undefined,
  true,
  123,
  'florp'
];

describe('@bayou/api-server/Target', () => {
  describe('constructor()', () => {
    it('should accept a key as the first argument', () => {
      assert.doesNotThrow(() => new Target(new BearerToken('x', 'y'), {}));
    });

    it('should accept a valid ID string as the first argument', () => {
      assert.doesNotThrow(() => new Target('x', {}));
    });

    it('should reject a non-key object as the first argument', () => {
      assert.throws(() => new Target(new Set('bad'), {}), /badValue/);
    });

    it('should reject an invalid ID string as the first argument', () => {
      assert.throws(() => new Target('***bad***', {}), /badValue/);
    });

    it('should accept arbitrary objects as the second argument', () => {
      for (const d of VALID_DIRECTS) {
        assert.doesNotThrow(() => new Target('x', d), inspect(d));
      }
    });

    it('should reject non-objects as the second argument', () => {
      for (const d of INVALID_DIRECTS) {
        assert.throws(() => new Target('x', d), /badValue/, inspect(d));
      }
    });

    it('should accept a `Schema` as the third argument', () => {
      const schema = new Schema({});
      assert.doesNotThrow(() => new Target('x', {}, schema));
    });
  });

  describe('.directObject', () => {
    it('should be the same as the `directObject` passed to the constructor', () => {
      for (const obj of VALID_DIRECTS) {
        const str = inspect(obj);
        const t   = new Target('x', obj);
        assert.strictEqual(t.directObject, obj, str);
      }
    });
  });

  describe('.id', () => {
    it('should be the same as a string `idOrKey` passed to the constructor', () => {
      const id = 'some-id';
      const t  = new Target(id, {});
      assert.strictEqual(t.id, id);
    });

    it('should be the same as the key\'s `id` when a key is passed as `idOrKey` to the constructor', () => {
      const id  = 'some-key-id';
      const key = new BearerToken(id, 'this-is-secret');
      const t   = new Target(key, {});
      assert.strictEqual(t.id, id);
    });
  });

  describe('.key', () => {
    it('should be the same as a key `idOrKey` passed to the constructor', () => {
      const id  = 'some-key-id';
      const key = new BearerToken(id, 'this-is-secret');
      const t  = new Target(key, {});
      assert.strictEqual(t.key, key);
    });

    it('should be `null` when a string is passed as `idOrKey` to the constructor', () => {
      const id  = 'some-id';
      const t   = new Target(id, {});
      assert.isNull(t.key);
    });
  });

  describe('.schema', () => {
    it('should be the same as the `schema` passed to the constructor', () => {
      const schema = new Schema({});
      const t      = new Target('x', {}, schema);

      assert.strictEqual(t.schema, schema);
    });
  });

  describe('call()', () => {
    it('should call through to the `directObject`', () => {
      const obj = {
        florp(x, y) {
          return `<${x} ${y}>`;
        }
      };

      const t      = new Target('x', obj);
      const result = t.call(new Functor('florp', 'hey', 'buddy'));

      assert.strictEqual(result, '<hey buddy>');
    });

    it('should be transparent with respect to thrown errors', () => {
      const err = new Error('eek!');
      const obj = {
        blort() {
          throw err;
        }
      };

      const t = new Target('x', obj);
      try {
        t.call(new Functor('blort'));
        assert.fail('Expected to throw.');
      } catch (e) {
        // Done this way instead of `assert.throws` so as to be able to do a
        // strict equality check.
        assert.strictEqual(e, err);
      }
    });
  });

  describe('withoutKey()', () => {
    it('should be the same as the original except with `null` for `key`', () => {
      const id   = 'some-key-id';
      const key  = new BearerToken(id, 'this-is-secret');
      const orig = new Target(key, {});
      const wk   = orig.withoutKey();

      assert.strictEqual(wk.directObject, orig.directObject);
      assert.strictEqual(wk.id, orig.id);
      assert.strictEqual(wk.schema, orig.schema);
      assert.isNull(wk.key);
    });
  });
});
