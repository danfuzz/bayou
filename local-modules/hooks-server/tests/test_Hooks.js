// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Mocks } from 'bayou-mocha';
import { BaseDocStore } from 'doc-store';
import { BearerTokens, Hooks } from 'hooks-server';

describe('hooks-server/Hooks', () => {
  describe('baseUrlFromRequest(request)', () => {
    it('should return a new URL referencing just the host with no path, query args, or anchors', () => {
      const request = Mocks.nodeRequest();
      const uri = Hooks.baseUrlFromRequest(request);

      assert.strictEqual(uri, 'http://example.com');
    });
  });

  describe('.bearerTokens', () => {
    it('should return an instance of `BearerTokens`', () => {
      assert.instanceOf(Hooks.bearerTokens, BearerTokens);
    });
  });

  describe('.docStore', () => {
    it('should return an instance of BaseDocStore', () => {
      assert.instanceOf(Hooks.docStore, BaseDocStore);
    });
  });

  describe('.listenPort', () => {
    it('should return the documented value', () => {
      assert.strictEqual(Hooks.listenPort, 8080);
    });
  });
});
