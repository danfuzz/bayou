// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BearerToken, Remote } from '@bayou/api-common';
import { BaseTokenAuthorizer, Context, ContextInfo, ProxiedObject } from '@bayou/api-server';
import { Codec } from '@bayou/codec';
import { Logger } from '@bayou/see-all';

/**
 * Mock `BaseTokenAuthorizer` for testing.
 */
class MockAuth extends BaseTokenAuthorizer {
  get _impl_nonTokenPrefix() {
    return 'nontoken-';
  }

  async _impl_cookieNamesForToken(value_unused) {
    return [];
  }

  async _impl_getAuthorizedTarget(token_unused, cookies_unused) {
    return { some: 'authority' };
  }

  _impl_isToken(tokenString_unused) {
    return true;
  }

  _impl_tokenFromString(tokenString) {
    return new BearerToken(tokenString, tokenString);
  }
}

describe('@bayou/api-server/Context', () => {
  describe('constructor()', () => {
    it('accepts valid arguments and produces a frozen instance', () => {
      const info   = new ContextInfo(new Codec(), new MockAuth());
      const result = new Context(info, new Logger('some-tag'));

      assert.isFrozen(result);
    });
  });

  describe('.codec', () => {
    it('is the `codec` from the `info` passed in on construction', () => {
      const info = new ContextInfo(new Codec(), new MockAuth());
      const ctx  = new Context(info, new Logger('some-tag'));

      assert.strictEqual(ctx.codec, info.codec);
    });
  });

  describe('.log', () => {
    it('is the `log` passed in on construction', () => {
      const info = new ContextInfo(new Codec(), new MockAuth());
      const log  = new Logger('yowzers');
      const ctx  = new Context(info, log);

      assert.strictEqual(ctx.log, log);
    });
  });

  describe('.tokenAuthorizer', () => {
    it('is the `tokenAuthorizer` from the `info` passed in on construction', () => {
      const info = new ContextInfo(new Codec(), new MockAuth());
      const ctx  = new Context(info, new Logger('some-tag'));

      assert.strictEqual(ctx.tokenAuthorizer, info.tokenAuthorizer);
    });
  });

  describe('getRemoteFor', () => {
    it('returns a `Remote` given a `ProxiedObject`', () => {
      const info   = new ContextInfo(new Codec());
      const ctx    = new Context(info, new Logger('some-tag'));
      const obj    = { some: 'object' };
      const po     = new ProxiedObject(obj);
      const result = ctx.getRemoteFor(po);

      assert.instanceOf(result, Remote);
    });

    it('returns a `Remote` whose `id` maps back to the underlying object', async () => {
      const info   = new ContextInfo(new Codec());
      const ctx    = new Context(info, new Logger('some-tag'));
      const obj    = { some: 'object' };
      const po     = new ProxiedObject(obj);
      const result = ctx.getRemoteFor(po);

      assert.isTrue(ctx.hasId(result.targetId));

      const target = await ctx.getAuthorizedTarget(result.targetId);

      assert.strictEqual(target.directObject, obj);
    });

    it('returns the same `Remote` when given the same `ProxiedObject`', () => {
      const info    = new ContextInfo(new Codec());
      const ctx     = new Context(info, new Logger('some-tag'));
      const obj     = { some: 'object' };
      const po      = new ProxiedObject(obj);
      const result1 = ctx.getRemoteFor(po);
      const result2 = ctx.getRemoteFor(po);

      assert.strictEqual(result1, result2);
    });

    it('returns the same `Remote` when given two `ProxiedObject`s for the same underlying object', () => {
      const info    = new ContextInfo(new Codec());
      const ctx     = new Context(info, new Logger('some-tag'));
      const obj     = { some: 'object' };
      const result1 = ctx.getRemoteFor(new ProxiedObject(obj));
      const result2 = ctx.getRemoteFor(new ProxiedObject(obj));

      assert.strictEqual(result1, result2);
    });
  });
});
