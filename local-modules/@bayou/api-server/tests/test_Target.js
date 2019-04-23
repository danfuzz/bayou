// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
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
    it('accepts a `BearerToken` as the first argument', () => {
      assert.doesNotThrow(() => new Target(new BearerToken('x', 'y'), {}));
    });

    it('accepts a valid ID string as the first argument', () => {
      assert.doesNotThrow(() => new Target('x', {}));
    });

    it('rejects a non-`BearerToken` object as the first argument', () => {
      assert.throws(() => new Target(new Set('bad'), {}), /badValue/);
    });

    it('rejects an invalid ID string as the first argument', () => {
      assert.throws(() => new Target('***bad***', {}), /badValue/);
    });

    it('accepts arbitrary objects as the second argument', () => {
      for (const d of VALID_DIRECTS) {
        assert.doesNotThrow(() => new Target('x', d), inspect(d));
      }
    });

    it('rejects non-objects as the second argument', () => {
      for (const d of INVALID_DIRECTS) {
        assert.throws(() => new Target('x', d), /badValue/, inspect(d));
      }
    });

    it('accepts a `Schema` as the third argument', () => {
      const schema = new Schema({});
      assert.doesNotThrow(() => new Target('x', {}, schema));
    });

    it('accepts `null` as the third argument', () => {
      assert.doesNotThrow(() => new Target('x', {}, null));
    });

    it('produces frozen instances', () => {
      const t = new Target('x', {});
      assert.isFrozen(t);
    });
  });

  describe('.className', () => {
    it('is the name of the class (constructor function) of `directObject`, if it has a class', () => {
      class Florp {}
      const t = new Target('x', new Florp());
      assert.strictEqual(t.className, 'Florp');
    });

    it('is `<unknown>` if `directObject` is a plain object', () => {
      const t = new Target('x', { x: 10 });
      assert.strictEqual(t.className, '<unknown>');
    });
  });

  describe('.directObject', () => {
    it('is the same as the `directObject` passed to the constructor', () => {
      for (const obj of VALID_DIRECTS) {
        const str = inspect(obj);
        const t   = new Target('x', obj);
        assert.strictEqual(t.directObject, obj, str);
      }
    });
  });

  describe('.id', () => {
    it('is the same as a string `idOrToken` passed to the constructor', () => {
      const id = 'some-id';
      const t  = new Target(id, {});
      assert.strictEqual(t.id, id);
    });

    it('is the same as the token\'s `id` when a `BearerToken` is passed as `idOrToken` to the constructor', () => {
      const id    = 'some-token-id';
      const token = new BearerToken(id, 'this-is-secret');
      const t     = new Target(token, {});
      assert.strictEqual(t.id, id);
    });
  });

  describe('.schema', () => {
    it('is the same as the non-`null` `schema` passed to the constructor', () => {
      const schema = new Schema({});
      const t      = new Target('x', {}, schema);

      assert.strictEqual(t.schema, schema);
    });

    it('is a reasonably-constructed instance when `schema` was omitted from the constructor', () => {
      class Florp {
        blort() { /*empty*/ }
        zorch() { /*empty*/ }
      }

      const t      = new Target('x', new Florp());
      const result = t.schema;

      assert.instanceOf(result, Schema);

      const props = result.propertiesObject;

      assert.deepEqual(props, { blort: 'method', zorch: 'method' });
    });
  });

  describe('.token', () => {
    it('is the same as a `BearerToken` `idOrToken` passed to the constructor', () => {
      const id    = 'some-token-id';
      const token = new BearerToken(id, 'this-is-secret');
      const t     = new Target(token, {});
      assert.strictEqual(t.token, token);
    });

    it('is `null` when a string is passed as `idOrToken` to the constructor', () => {
      const id  = 'some-id';
      const t   = new Target(id, {});
      assert.isNull(t.token);
    });
  });

  describe('call()', () => {
    it('calls through to the `directObject`', () => {
      const obj = {
        florp(x, y) {
          return `<${x} ${y}>`;
        }
      };

      const t      = new Target('x', obj);
      const result = t.call(new Functor('florp', 'hey', 'buddy'));

      assert.strictEqual(result, '<hey buddy>');
    });

    it('is transparent with respect to thrown errors', () => {
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
});
