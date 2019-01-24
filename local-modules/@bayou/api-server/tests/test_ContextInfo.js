// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Context, ContextInfo, TokenAuthorizer } from '@bayou/api-server';
import { Codec } from '@bayou/codec';

describe('@bayou/api-server/ContextInfo', () => {
  describe('constructor()', () => {
    it('accepts a single valid argument and produces a frozen instance', () => {
      const result = new ContextInfo(new Codec());
      assert.isFrozen(result);
    });

    it('accepts two valid arguments and produces a frozen instance', () => {
      const result = new ContextInfo(new Codec(), new TokenAuthorizer());
      assert.isFrozen(result);
    });

    it('accepts `null` as the second argument', () => {
      const result = new ContextInfo(new Codec(), null);
      assert.isFrozen(result);
    });
  });

  describe('.codec', () => {
    it('is the value passed into the constructor', () => {
      const codec = new Codec();
      const ci    = new ContextInfo(codec);

      assert.strictEqual(ci.codec, codec);
    });
  });

  describe('.tokenAuthorizer', () => {
    it('is the non-`null` value passed into the constructor', () => {
      const ta = new TokenAuthorizer();
      const ci = new ContextInfo(new Codec(), ta);

      assert.strictEqual(ci.tokenAuthorizer, ta);
    });

    it('is `null` if passed into the constructor as such', () => {
      const ci = new ContextInfo(new Codec(), null);

      assert.isNull(ci.tokenAuthorizer);
    });

    it('is `null` if omitted from the constructor', () => {
      const ci = new ContextInfo(new Codec());

      assert.isNull(ci.tokenAuthorizer);
    });
  });

  describe('makeContext()', () => {
    it('makes an instance of `Context` with this instance as the `info` and with the given tag', () => {
      const ci     = new ContextInfo(new Codec(), new TokenAuthorizer());
      const tag    = 'florp';
      const result = ci.makeContext(tag);

      assert.instanceOf(result, Context);
      assert.strictEqual(result.codec, ci.codec);
      assert.strictEqual(result.tokenAuthorizer, ci.tokenAuthorizer);

      const logContext = result.log.tag.context;
      assert.strictEqual(logContext[logContext.length - 1], tag);
    });
  });
});
