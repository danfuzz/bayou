// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Codecs, Message, Remote } from '@bayou/api-common';
import { BaseConnection, Context, ContextInfo, ProxiedObject } from '@bayou/api-server';
import { Codec } from '@bayou/codec';
import { Functor } from '@bayou/util-common';

import { MockTokenAuthorizer } from '@bayou/api-server/mocks';

describe('@bayou/api-server/Context', () => {
  describe('constructor()', () => {
    it('accepts valid arguments and produces a frozen instance', () => {
      const info   = new ContextInfo(new Codec(), new MockTokenAuthorizer());
      const conn   = new BaseConnection(info);
      const result = new Context(info, conn);

      assert.isFrozen(result);
    });
  });

  describe('.codec', () => {
    it('is the `codec` from the `info` passed in on construction', () => {
      const info = new ContextInfo(new Codec(), new MockTokenAuthorizer());
      const conn = new BaseConnection(info);
      const ctx  = new Context(info, conn);

      assert.strictEqual(ctx.codec, info.codec);
    });
  });

  describe('.log', () => {
    it('is the `log` of the connection passed in on construction', () => {
      const info = new ContextInfo(new Codec(), new MockTokenAuthorizer());
      const conn = new BaseConnection(info);
      const ctx  = new Context(info, conn);

      assert.strictEqual(ctx.log, conn.log);
    });
  });

  describe('.tokenAuthorizer', () => {
    it('is the `tokenAuthorizer` from the `info` passed in on construction', () => {
      const info = new ContextInfo(new Codec(), new MockTokenAuthorizer());
      const conn = new BaseConnection(info);
      const ctx  = new Context(info, conn);

      assert.strictEqual(ctx.tokenAuthorizer, info.tokenAuthorizer);
    });
  });

  describe('decodeJson()', () => {
    it('calls through to the codec', () => {
      let gotJson = null;

      class TestCodec extends Codec {
        decodeJson(encoded) {
          gotJson = encoded;
          return super.decodeJson(encoded);
        }
      }

      const codec   = new TestCodec();
      const info    = new ContextInfo(codec);
      const conn    = new BaseConnection(info);
      const ctx     = new Context(info, conn);
      const value   = ['what', 'is', 'the', 'meaning', 'of', 42];
      const encoded = codec.encodeJson(value);
      const got     = ctx.decodeJson(encoded);

      assert.strictEqual(gotJson, encoded);
      assert.deepEqual(got, value);
    });
  });

  describe('encodeJson()', () => {
    it('calls through to the codec', () => {
      let gotValue = null;

      class TestCodec extends Codec {
        encodeJson(value) {
          gotValue = value;
          return super.encodeJson(value);
        }
      }

      const codec   = new TestCodec();
      const info    = new ContextInfo(codec);
      const conn    = new BaseConnection(info);
      const ctx     = new Context(info, conn);
      const value   = { hello: 'there', what: 'is happening?' };
      const encoded = codec.encodeJson(value);
      const got     = ctx.encodeJson(value);

      assert.strictEqual(gotValue, value);
      assert.strictEqual(got, encoded);
    });
  });

  describe('encodeMessage()', () => {
    it('calls through to the codec when given a `Message`', () => {
      let gotValue = null;

      class TestCodec extends Codec {
        encodeJson(value) {
          gotValue = value;
          return super.encodeJson(value);
        }
      }

      const codec = new TestCodec();
      Codecs.registerCodecs(codec.registry);

      const info    = new ContextInfo(codec);
      const conn    = new BaseConnection(info);
      const ctx     = new Context(info, conn);
      const value   = new Message(1, 'florp', new Functor('xyz', 'pdq'));
      const encoded = codec.encodeJson(value);
      const got     = ctx.encodeMessage(value);

      assert.strictEqual(gotValue, value);
      assert.strictEqual(got, encoded);
    });

    it('rejects non-`Message` arguments', () => {
      const codec = new Codec();
      Codecs.registerCodecs(codec.registry);

      const info = new ContextInfo(codec);
      const conn = new BaseConnection(info);
      const ctx  = new Context(info, conn);

      function test(v) {
        assert.throws(() => ctx.encodeMessage(v), /badValue/);
      }

      test(undefined);
      test(null);
      test('boo');
      test([123]);
      test({ x: '123' });
    });
  });

  describe('getRemoteFor()', () => {
    it('returns a `Remote` given a `ProxiedObject`', () => {
      const info   = new ContextInfo(new Codec());
      const conn   = new BaseConnection(info);
      const ctx    = new Context(info, conn);
      const obj    = { some: 'object' };
      const po     = new ProxiedObject(obj);
      const result = ctx.getRemoteFor(po);

      assert.instanceOf(result, Remote);
    });

    it('returns a `Remote` whose `id` maps back to the underlying object', async () => {
      const info   = new ContextInfo(new Codec());
      const conn   = new BaseConnection(info);
      const ctx    = new Context(info, conn);
      const obj    = { some: 'object' };
      const po     = new ProxiedObject(obj);
      const result = ctx.getRemoteFor(po);

      assert.isTrue(ctx.hasId(result.targetId));

      const target = await ctx.getAuthorizedTarget(result.targetId);

      assert.strictEqual(target.directObject, obj);
    });

    it('returns the same `Remote` when given the same `ProxiedObject`', () => {
      const info    = new ContextInfo(new Codec());
      const conn    = new BaseConnection(info);
      const ctx     = new Context(info, conn);
      const obj     = { some: 'object' };
      const po      = new ProxiedObject(obj);
      const result1 = ctx.getRemoteFor(po);
      const result2 = ctx.getRemoteFor(po);

      assert.strictEqual(result1, result2);
    });

    it('returns the same `Remote` when given two `ProxiedObject`s for the same underlying object', () => {
      const info    = new ContextInfo(new Codec());
      const conn    = new BaseConnection(info);
      const ctx     = new Context(info, conn);
      const obj     = { some: 'object' };
      const result1 = ctx.getRemoteFor(new ProxiedObject(obj));
      const result2 = ctx.getRemoteFor(new ProxiedObject(obj));

      assert.strictEqual(result1, result2);
    });
  });
});
