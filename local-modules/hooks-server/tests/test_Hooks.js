// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BaseFileStore } from 'file-store';
import { BearerTokens, Hooks } from 'hooks-server';

describe('hooks-server/Hooks', () => {
  describe('.bearerTokens', () => {
    it('should return an instance of `BearerTokens`', () => {
      assert.instanceOf(Hooks.theOne.bearerTokens, BearerTokens);
    });
  });

  describe('.fileStore', () => {
    it('should return an instance of BaseFileStore', () => {
      assert.instanceOf(Hooks.theOne.fileStore, BaseFileStore);
    });
  });

  describe('isFileId(id)', () => {
    it('should accept 32-character alphanum ASCII strings', () => {
      assert.isTrue(Hooks.theOne.isFileId('123abc7890ABC456789012'));
    });

    it('should allow underscores and hyphens', () => {
      assert.isTrue(Hooks.theOne.isFileId('123456789_123456789-12'));
    });

    it('should not allow non-ASCII characters', () => {
      assert.isFalse(Hooks.theOne.isFileId('123456789•123456789•12'));
    });

    it('should not allow non-alphanum characters', () => {
      assert.isFalse(Hooks.theOne.isFileId('123456789\t123456789+12'));
    });
  });

  describe('.listenPort', () => {
    it('should return the documented value', () => {
      assert.strictEqual(Hooks.theOne.listenPort, 8080);
    });
  });
});
